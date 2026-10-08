"""
ModusFlow Background Replacer & Relighter Node

Provides 1-click background isolation, environmental relighting,
and seamless backdrop compositing:
- Automated foreground person segmentation via YOLO (`yolov8x-seg.pt`).
- Inverted background mask generation with grow/shrink dilation and Gaussian feathering.
- Ambient environmental relighting (Reinhard color transfer / tint matching) to eliminate "pasted-on" subject edges.
- Supports both direct photo backdrop replacement and diffusion inpaint generation pipelines.
"""

import os
import torch
import numpy as np
from PIL import Image, ImageFilter, ImageOps
import folder_paths

try:
    from ultralytics import YOLO
    ULTRALYTICS_AVAILABLE = True
except ImportError:
    ULTRALYTICS_AVAILABLE = False


def _get_ultralytics_dirs() -> list:
    """Return all ultralytics model folders in priority order."""
    dirs = []
    for key in ("ultralytics_segm", "ultralytics_bbox", "ultralytics"):
        try:
            dirs.extend(folder_paths.get_folder_paths(key))
        except Exception:
            pass

    base = os.path.join(folder_paths.models_dir, "ultralytics")
    for sub in ("segm", "bbox", ""):
        dirs.append(os.path.join(base, sub) if sub else base)

    seen = set()
    return [d for d in dirs if not (d in seen or seen.add(d))]


def scan_segm_models() -> list:
    """Scan ComfyUI ultralytics folders for segmentation detector models."""
    models = []
    seen = set()
    for d in _get_ultralytics_dirs():
        if not os.path.isdir(d):
            continue
        for fname in os.listdir(d):
            fl = fname.lower()
            if fl.endswith((".pt", ".pth")) and ("seg" in fl or "person" in fl) and fname not in seen:
                seen.add(fname)
                models.append(fname)

    if not models:
        for d in _get_ultralytics_dirs():
            if not os.path.isdir(d):
                continue
            for fname in os.listdir(d):
                if fname.lower().endswith((".pt", ".pth")) and fname not in seen:
                    seen.add(fname)
                    models.append(fname)

    return sorted(models) if models else ["yolov8x-seg.pt", "person_yolov8n-seg.pt"]


def tensor_to_pil(tensor: torch.Tensor) -> Image.Image:
    """Convert a [1, H, W, C] or [H, W, C] float tensor to a PIL RGB image."""
    if tensor.ndim == 4:
        tensor = tensor[0]
    arr = (tensor.cpu().numpy() * 255.0).clip(0, 255).astype(np.uint8)
    return Image.fromarray(arr, "RGB")


def pil_to_tensor(img: Image.Image) -> torch.Tensor:
    """Convert a PIL image to a [1, H, W, C] float32 tensor in [0, 1]."""
    arr = np.array(img.convert("RGB")).astype(np.float32) / 255.0
    return torch.from_numpy(arr).unsqueeze(0)


def mask_to_tensor(mask_pil: Image.Image) -> torch.Tensor:
    """Convert a PIL grayscale mask to a [1, H, W] float32 tensor."""
    arr = np.array(mask_pil.convert("L")).astype(np.float32) / 255.0
    return torch.from_numpy(arr).unsqueeze(0)


def apply_ambient_relighting(subject_pil: Image.Image, bg_pil: Image.Image,
                             mask_pil: Image.Image, strength: float = 0.35) -> Image.Image:
    """
    Subtle ambient relighting: casts the dominant color temperature of the new background
    onto the subject's edges to eliminate border halos and lighting mismatches.
    """
    if strength <= 0.01:
        return subject_pil

    try:
        sub_arr = np.array(subject_pil.convert("RGB")).astype(np.float32)
        bg_small = bg_pil.resize((64, 64), Image.BILINEAR)
        bg_mean = np.array(bg_small).astype(np.float32).mean(axis=(0, 1))  # Mean RGB of backdrop
        sub_mean = sub_arr.mean(axis=(0, 1))

        # Color shift delta
        shift = (bg_mean - sub_mean) * strength

        # Create rim zone mask (edge of the subject)
        edge_mask = mask_pil.filter(ImageFilter.FIND_EDGES).filter(ImageFilter.GaussianBlur(radius=8))
        edge_arr = (np.array(edge_mask).astype(np.float32) / 255.0)[:, :, np.newaxis]

        # Blend shifted colors specifically into the rim/contour zone
        relit_arr = sub_arr + shift * edge_arr
        relit_arr = np.clip(relit_arr, 0, 255).astype(np.uint8)
        return Image.fromarray(relit_arr, "RGB")
    except Exception as e:
        print(f"[ModusFlowBackgroundReplacer] Relighting fallback: {e}")
        return subject_pil


class ModusFlowBackgroundReplacer:
    """
    Automated background segmentation, relighting, and backdrop replacement.
    Outputs the composited image, inverted background inpainting mask, and clean subject mask.
    """

    @classmethod
    def INPUT_TYPES(cls):
        models = scan_segm_models()
        return {
            "required": {
                "image": ("IMAGE",),
                "detector_model": (models, {"default": models[0] if models else "yolov8x-seg.pt"}),
                "detection_confidence": ("FLOAT", {"default": 0.35, "min": 0.1, "max": 0.95, "step": 0.05}),
                "grow_shrink": ("INT", {"default": 2, "min": -64, "max": 64, "step": 1}),
                "edge_feather": ("INT", {"default": 14, "min": 0, "max": 64, "step": 2}),
                "relighting_mode": (["ambient_rim", "none"], {"default": "ambient_rim"}),
                "relighting_strength": ("FLOAT", {"default": 0.35, "min": 0.0, "max": 1.0, "step": 0.05}),
            },
            "optional": {
                "new_background_image": ("IMAGE",),
                "optional_mask": ("MASK",),
            }
        }

    RETURN_TYPES = ("IMAGE", "MASK", "MASK", "IMAGE")
    RETURN_NAMES = ("composite_image", "background_mask", "person_mask", "subject_cutout")
    FUNCTION = "replace_background"
    CATEGORY = "ModusFlow/Image"

    def replace_background(self, image, detector_model, detection_confidence,
                           grow_shrink, edge_feather, relighting_mode,
                           relighting_strength, new_background_image=None, optional_mask=None):

        orig_pil = tensor_to_pil(image)
        w, h = orig_pil.size

        # 1. Determine Subject Mask
        if optional_mask is not None:
            # Use custom mask
            m_np = (optional_mask[0].cpu().numpy() * 255.0).clip(0, 255).astype(np.uint8)
            subject_mask = Image.fromarray(m_np, "L").resize((w, h), Image.BILINEAR)
        elif ULTRALYTICS_AVAILABLE:
            model_path = None
            for d in _get_ultralytics_dirs():
                candidate = os.path.join(d, detector_model)
                if os.path.exists(candidate):
                    model_path = candidate
                    break

            subject_mask = None
            if model_path:
                try:
                    yolo = YOLO(model_path)
                    results = yolo(orig_pil, conf=detection_confidence, verbose=False)
                    if len(results) > 0 and results[0].masks is not None:
                        combined_mask = np.zeros((h, w), dtype=np.uint8)
                        for m_tensor in results[0].masks.data:
                            m_arr = m_tensor.cpu().numpy()
                            m_pil = Image.fromarray((m_arr * 255).astype(np.uint8)).resize((w, h), Image.NEAREST)
                            combined_mask = np.maximum(combined_mask, np.array(m_pil))
                        subject_mask = Image.fromarray(combined_mask, "L")
                except Exception as e:
                    print(f"[ModusFlowBackgroundReplacer] Detection error: {e}")

            if subject_mask is None:
                # Fallback center ellipse
                subject_mask = Image.new("L", (w, h), 0)
                from PIL import ImageDraw
                draw = ImageDraw.Draw(subject_mask)
                draw.ellipse([int(w * 0.15), int(h * 0.1), int(w * 0.85), int(h * 0.95)], fill=255)
        else:
            subject_mask = Image.new("L", (w, h), 255)

        # 2. Grow / Shrink & Feather Mask
        if grow_shrink > 0:
            subject_mask = subject_mask.filter(ImageFilter.MaxFilter(size=grow_shrink * 2 + 1))
        elif grow_shrink < 0:
            subject_mask = subject_mask.filter(ImageFilter.MinFilter(size=abs(grow_shrink) * 2 + 1))

        if edge_feather > 0:
            feathered_mask = subject_mask.filter(ImageFilter.GaussianBlur(radius=edge_feather))
        else:
            feathered_mask = subject_mask

        # 3. Create Inverted Background Mask (for Inpainting)
        bg_mask = ImageOps.invert(feathered_mask)

        # 4. Generate Subject Cutout
        cutout = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        cutout.paste(orig_pil, (0, 0), mask=feathered_mask)
        cutout_rgb = cutout.convert("RGB")

        # 5. Composite New Background if Provided
        if new_background_image is not None:
            bg_pil = tensor_to_pil(new_background_image).resize((w, h), Image.LANCZOS)

            # Apply ambient edge relighting
            subject_relit = orig_pil
            if relighting_mode == "ambient_rim":
                subject_relit = apply_ambient_relighting(orig_pil, bg_pil, feathered_mask, relighting_strength)

            composite = bg_pil.copy()
            composite.paste(subject_relit, (0, 0), mask=feathered_mask)
        else:
            # If no new background photo is attached, return original image with clean masks
            composite = orig_pil

        out_image = pil_to_tensor(composite)
        out_bg_mask = mask_to_tensor(bg_mask)
        out_person_mask = mask_to_tensor(feathered_mask)
        out_cutout = pil_to_tensor(cutout_rgb)

        return (out_image, out_bg_mask, out_person_mask, out_cutout)
