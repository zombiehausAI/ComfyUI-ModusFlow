"""
ModusFlow VAE Encode & Fidelity Controller Nodes

Provides:
- ModusFlowLoadImage: Native image loader with upload support.
- ModusFlowVAEEncode: Modular VAE encoding with automatic model alignment (Flux/Chroma 16px, SDXL/SD1.5 8px).
- ModusFlowFidelityController: Standalone slider & preset controller mapping human-friendly similarity (0-100%) to denoise & steps.
- ModusFlowImg2ImgVAEEncode: All-in-one node combining image loading/upload, VAE encode, fidelity slider, and pipe passthrough.
"""

import os
import math
import torch
import torch.nn.functional as F
import numpy as np
from PIL import Image, ImageOps
import folder_paths


def _align_image_tensor(image_tensor, alignment_mode="Auto (16px for Flux/Chroma, 8px for SD)", resize_mode="Crop to Multiple"):
    """
    Ensure image dimensions match model patch/downscale requirements:
    - Flux / Chroma: divisible by 16 (8x VAE downscale * 2x2 DiT patch)
    - SDXL / Pony / Illustrious / SD 1.5: divisible by 8
    """
    if image_tensor is None:
        return None

    # image_tensor shape: [B, H, W, C]
    _, h, w, _ = image_tensor.shape

    div = 16
    if "8px" in alignment_mode or "SDXL" in alignment_mode or "SD 1.5" in alignment_mode:
        div = 8
    elif alignment_mode == "None":
        return image_tensor

    target_w = (w // div) * div
    target_h = (h // div) * div

    if target_w == 0:
        target_w = div
    if target_h == 0:
        target_h = div

    if target_w == w and target_h == h:
        return image_tensor

    # Permute to [B, C, H, W] for torch operations
    img = image_tensor.permute(0, 3, 1, 2)

    if resize_mode == "Rescale to Multiple":
        img = F.interpolate(img, size=(target_h, target_w), mode="bicubic", align_corners=False)
    elif resize_mode == "Pad to Multiple":
        pad_w = (div - (w % div)) % div
        pad_h = (div - (h % div)) % div
        pad_left = pad_w // 2
        pad_right = pad_w - pad_left
        pad_top = pad_h // 2
        pad_bottom = pad_h - pad_top
        img = F.pad(img, (pad_left, pad_right, pad_top, pad_bottom), mode="reflect")
    else:
        # Default: Crop to Multiple (Center crop, preserving aspect ratio and crispness)
        crop_x = (w - target_w) // 2
        crop_y = (h - target_h) // 2
        img = img[:, :, crop_y:crop_y + target_h, crop_x:crop_x + target_w]

    img = img.permute(0, 2, 3, 1).contiguous()
    return img


def _compute_fidelity_mapping(fidelity_pct, curve="Smooth S-Curve", min_denoise=0.20, max_denoise=0.95,
                              base_steps=25, step_compensation=True, target_model="Chroma 1-HD"):
    """
    Map similarity/fidelity (0 - 100%) to diffusion denoise and recommended steps:
    - 100% fidelity: exact replica + LoRA/style (denoise = min_denoise)
    - 0% fidelity: barely recognizable (denoise = max_denoise)
    """
    fidelity_clamped = max(0.0, min(100.0, float(fidelity_pct)))
    f = fidelity_clamped / 100.0  # 1.0 (exact replica) down to 0.0 (total change)
    t = 1.0 - f                  # 0.0 (no transform) up to 1.0 (full transform)

    # Apply transformation curve
    if curve == "Linear":
        factor = t
    elif curve == "Preserve Structure (Exponential)":
        factor = math.pow(t, 1.45)
    elif curve == "Creative Bias":
        factor = math.pow(t, 0.72)
    else:
        # Default: Smooth S-Curve (Hermite smoothstep)
        factor = t * t * (3.0 - 2.0 * t)

    # Calculate denoise
    denoise = min_denoise + factor * (max_denoise - min_denoise)
    denoise = round(float(denoise), 3)

    # Step compensation
    # At low denoise (e.g. 0.25), effective steps = steps * denoise = ~6 steps.
    # We compensate so the sampler executes enough actual diffusion passes to resolve fine style details.
    if step_compensation and denoise > 0.01:
        if "Chroma" in target_model or "Flux" in target_model:
            target_effective = 12.0
            compensated = max(base_steps, int(round(target_effective / denoise)))
            steps = min(60, compensated)
        elif "SDXL" in target_model or "Pony" in target_model or "Illustrious" in target_model:
            target_effective = 15.0
            compensated = max(base_steps, int(round(target_effective / denoise)))
            steps = min(60, compensated)
        else:
            target_effective = 14.0
            compensated = max(base_steps, int(round(target_effective / denoise)))
            steps = min(60, compensated)
    else:
        steps = int(base_steps)

    effective_steps = max(1, int(round(steps * denoise)))

    # Human-readable interpretation
    if fidelity_clamped >= 88.0:
        desc = f"Replica Mode ({fidelity_clamped:.0f}% fidelity) — Preserves geometry, pose, face identity; applies LoRA/texture styling."
    elif fidelity_clamped >= 68.0:
        desc = f"Faithful Restyle ({fidelity_clamped:.0f}% fidelity) — Maintains subject and composition; adapts fine details to prompt/style."
    elif fidelity_clamped >= 45.0:
        desc = f"Balanced Reimagining ({fidelity_clamped:.0f}% fidelity) — Preserves layout, framing, and color palette; restyles subject freely."
    elif fidelity_clamped >= 20.0:
        desc = f"Creative Divergence ({fidelity_clamped:.0f}% fidelity) — Original image acts as abstract inspiration; model generates new subjects."
    else:
        desc = f"Barely Recognizable ({fidelity_clamped:.0f}% fidelity) — Full creative freedom; minimal resemblance to original."

    summary = f"Fidelity: {fidelity_clamped:.0f}% | Denoise: {denoise:.3f} | Steps: {steps} (Effective: ~{effective_steps}) | {desc}"
    return denoise, steps, fidelity_clamped, summary


class ModusFlowLoadImage:
    """
    Dedicated image loader node for ModusFlow workflows with instant upload support.
    """
    @classmethod
    def INPUT_TYPES(cls):
        input_dir = folder_paths.get_input_directory()
        files = []
        if os.path.isdir(input_dir):
            files = [
                f for f in os.listdir(input_dir)
                if os.path.isfile(os.path.join(input_dir, f)) and f.lower().endswith(('.png', '.jpg', '.jpeg', '.webp', '.bmp', '.tiff'))
            ]
            files.sort()
        return {
            "required": {
                "image": (files if files else ["none"], {"image_upload": True}),
            }
        }

    CATEGORY = "ModusFlow/Image"
    RETURN_TYPES = ("IMAGE", "MASK", "INT", "INT", "STRING")
    RETURN_NAMES = ("image", "mask", "width", "height", "filename")
    FUNCTION = "load_image"

    def load_image(self, image):
        if not image or image == "none":
            # Return blank placeholder tensor
            blank = torch.zeros((1, 1024, 1024, 3), dtype=torch.float32)
            mask = torch.zeros((1, 1024, 1024), dtype=torch.float32)
            return (blank, mask, 1024, 1024, "none")

        image_path = folder_paths.get_annotated_filepath(image)
        i = Image.open(image_path)
        i = ImageOps.exif_transpose(i)
        image_rgb = i.convert("RGB")
        img_np = np.array(image_rgb).astype(np.float32) / 255.0
        img_tensor = torch.from_numpy(img_np)[None,]

        # Extract mask if alpha channel exists
        if "A" in i.getbands():
            mask_np = np.array(i.getchannel("A")).astype(np.float32) / 255.0
            mask_tensor = 1.0 - torch.from_numpy(mask_np)
        else:
            mask_tensor = torch.zeros((i.size[1], i.size[0]), dtype=torch.float32, device="cpu")

        return (img_tensor, mask_tensor.unsqueeze(0), i.size[0], i.size[1], os.path.basename(image_path))


class ModusFlowVAEEncode:
    """
    Modular VAE encoder for ModusFlow with automatic architecture alignment
    (16px grid for Flux/Chroma, 8px grid for SDXL/Pony/Illustrious/SD1.5).
    """
    @classmethod
    def INPUT_TYPES(cls):
        input_dir = folder_paths.get_input_directory()
        files = []
        if os.path.isdir(input_dir):
            files = [
                f for f in os.listdir(input_dir)
                if os.path.isfile(os.path.join(input_dir, f)) and f.lower().endswith(('.png', '.jpg', '.jpeg', '.webp', '.bmp', '.tiff'))
            ]
            files.sort()

        alignment_options = [
            "Auto (16px for Flux/Chroma, 8px for SD)",
            "Divisible by 16 (Flux / Chroma)",
            "Divisible by 8 (SDXL / Pony / Illustrious / SD 1.5)",
            "None",
        ]
        resize_options = ["Crop to Multiple", "Rescale to Multiple", "Pad to Multiple"]

        return {
            "required": {
                "alignment": (alignment_options, {"default": alignment_options[0]}),
                "resize_mode": (resize_options, {"default": resize_options[0]}),
            },
            "optional": {
                "image": ("IMAGE",),
                "image_upload": (files if files else ["none"], {"image_upload": True}),
                "vae": ("VAE",),
                "pipe": ("PIPE",),
                "mask": ("MASK",),
            }
        }

    CATEGORY = "ModusFlow/Latent"
    RETURN_TYPES = ("LATENT", "IMAGE", "INT", "INT", "PIPE")
    RETURN_NAMES = ("latent", "image", "width", "height", "pipe")
    FUNCTION = "encode"

    def encode(self, alignment, resize_mode, image=None, image_upload="none", vae=None, pipe=None, mask=None):
        # Resolve VAE from input or pipe
        resolved_vae = vae
        if resolved_vae is None and pipe is not None and len(pipe) > 2:
            resolved_vae = pipe[2]

        if resolved_vae is None:
            raise ValueError("[ModusFlow VAE Encode] VAE is required (provide via 'vae' input or 'pipe').")

        # Resolve Image
        img_tensor = image
        if img_tensor is None and image_upload and image_upload != "none":
            image_path = folder_paths.get_annotated_filepath(image_upload)
            if os.path.exists(image_path):
                i = Image.open(image_path)
                i = ImageOps.exif_transpose(i).convert("RGB")
                img_np = np.array(i).astype(np.float32) / 255.0
                img_tensor = torch.from_numpy(img_np)[None,]

        if img_tensor is None:
            raise ValueError("[ModusFlow VAE Encode] IMAGE is required (connect 'image' or choose an uploaded file).")

        # Detect model alignment if Auto
        target_align = alignment
        if alignment.startswith("Auto"):
            # If VAE has 16 latent channels or is Flux-based, use 16px
            is_flux = False
            if hasattr(resolved_vae, "latent_dim") and resolved_vae.latent_dim == 16:
                is_flux = True
            elif hasattr(resolved_vae, "first_stage_model") and hasattr(resolved_vae.first_stage_model, "z_channels") and resolved_vae.first_stage_model.z_channels == 16:
                is_flux = True
            target_align = "Divisible by 16 (Flux / Chroma)" if is_flux else "Divisible by 8 (SDXL / Pony / Illustrious / SD 1.5)"

        # Align dimensions
        aligned_image = _align_image_tensor(img_tensor, target_align, resize_mode)
        _, h, w, _ = aligned_image.shape

        # Encode with VAE
        latent_tensor = resolved_vae.encode(aligned_image[:, :, :, :3])
        latent_dict = {"samples": latent_tensor, "width": w, "height": h}

        # Apply noise mask for inpainting if provided
        if mask is not None:
            # Mask shape: [B, H, W] -> resize to latent spatial dims
            lat_h = latent_tensor.shape[-2]
            lat_w = latent_tensor.shape[-1]
            m = mask.unsqueeze(1)
            m_resized = F.interpolate(m, size=(lat_h, lat_w), mode="bilinear", align_corners=False)
            latent_dict["noise_mask"] = m_resized.squeeze(1)

        return (latent_dict, aligned_image, w, h, pipe)


class ModusFlowFidelityController:
    """
    Human-friendly image fidelity slider (0 - 100%) that calculates and outputs
    optimal denoise and step compensation for Chroma, Flux, SDXL, Pony, and Illustrious.
    """
    @classmethod
    def INPUT_TYPES(cls):
        presets = [
            "Custom (Use Slider)",
            "Replica + Style / LoRA (90% Fidelity)",
            "Faithful Restyle (75% Fidelity)",
            "Balanced Reimagining (50% Fidelity)",
            "Creative Divergence (25% Fidelity)",
            "Barely Recognizable (10% Fidelity)",
        ]
        target_models = [
            "Chroma 1-HD",
            "Flux.1 (Dev / Schnell)",
            "SDXL / Pony / Illustrious",
            "SD 1.5",
            "Custom / Generic",
        ]
        curves = [
            "Smooth S-Curve",
            "Linear",
            "Preserve Structure (Exponential)",
            "Creative Bias",
        ]

        return {
            "required": {
                "fidelity": ("FLOAT", {"default": 75.0, "min": 0.0, "max": 100.0, "step": 1.0, "display": "slider"}),
                "preset": (presets, {"default": presets[0]}),
                "target_model": (target_models, {"default": target_models[0]}),
                "curve": (curves, {"default": curves[0]}),
                "base_steps": ("INT", {"default": 25, "min": 1, "max": 10000, "step": 1}),
                "step_compensation": ("BOOLEAN", {"default": True}),
                "min_denoise": ("FLOAT", {"default": 0.20, "min": 0.0, "max": 1.0, "step": 0.01}),
                "max_denoise": ("FLOAT", {"default": 0.95, "min": 0.0, "max": 1.0, "step": 0.01}),
            },
            "optional": {
                "pipe": ("PIPE",),
            }
        }

    CATEGORY = "ModusFlow/Sampling"
    RETURN_TYPES = ("FLOAT", "INT", "FLOAT", "STRING", "PIPE")
    RETURN_NAMES = ("denoise", "steps", "fidelity_pct", "summary", "pipe")
    FUNCTION = "calculate"

    def calculate(self, fidelity, preset, target_model, curve, base_steps, step_compensation, min_denoise, max_denoise, pipe=None):
        active_fidelity = fidelity
        if preset == "Replica + Style / LoRA (90% Fidelity)":
            active_fidelity = 90.0
        elif preset == "Faithful Restyle (75% Fidelity)":
            active_fidelity = 75.0
        elif preset == "Balanced Reimagining (50% Fidelity)":
            active_fidelity = 50.0
        elif preset == "Creative Divergence (25% Fidelity)":
            active_fidelity = 25.0
        elif preset == "Barely Recognizable (10% Fidelity)":
            active_fidelity = 10.0

        denoise, steps, fidelity_pct, summary = _compute_fidelity_mapping(
            fidelity_pct=active_fidelity,
            curve=curve,
            min_denoise=min_denoise,
            max_denoise=max_denoise,
            base_steps=base_steps,
            step_compensation=step_compensation,
            target_model=target_model
        )

        return (denoise, steps, fidelity_pct, summary, pipe)


class ModusFlowImg2ImgVAEEncode:
    """
    All-in-One Image-to-Image Node for ModusFlow.
    Combines image loading/upload, VAE encoding, automatic architecture alignment,
    human-friendly fidelity slider (0-100%), and unified PIPE passthrough.
    """
    @classmethod
    def INPUT_TYPES(cls):
        input_dir = folder_paths.get_input_directory()
        files = []
        if os.path.isdir(input_dir):
            files = [
                f for f in os.listdir(input_dir)
                if os.path.isfile(os.path.join(input_dir, f)) and f.lower().endswith(('.png', '.jpg', '.jpeg', '.webp', '.bmp', '.tiff'))
            ]
            files.sort()

        presets = [
            "Custom (Use Slider)",
            "Replica + Style / LoRA (90% Fidelity)",
            "Faithful Restyle (75% Fidelity)",
            "Balanced Reimagining (50% Fidelity)",
            "Creative Divergence (25% Fidelity)",
            "Barely Recognizable (10% Fidelity)",
        ]
        target_models = [
            "Chroma 1-HD",
            "Flux.1 (Dev / Schnell)",
            "SDXL / Pony / Illustrious",
            "SD 1.5",
            "Custom / Generic",
        ]
        alignment_options = [
            "Auto (16px for Flux/Chroma, 8px for SD)",
            "Divisible by 16 (Flux / Chroma)",
            "Divisible by 8 (SDXL / Pony / Illustrious / SD 1.5)",
            "None",
        ]
        resize_options = ["Crop to Multiple", "Rescale to Multiple", "Pad to Multiple"]
        curves = [
            "Smooth S-Curve",
            "Linear",
            "Preserve Structure (Exponential)",
            "Creative Bias",
        ]

        return {
            "required": {
                "image_upload": (files if files else ["none"], {"image_upload": True}),
                "fidelity": ("FLOAT", {"default": 75.0, "min": 0.0, "max": 100.0, "step": 1.0, "display": "slider"}),
                "preset": (presets, {"default": presets[0]}),
                "target_model": (target_models, {"default": target_models[0]}),
                "alignment": (alignment_options, {"default": alignment_options[0]}),
                "resize_mode": (resize_options, {"default": resize_options[0]}),
                "curve": (curves, {"default": curves[0]}),
                "base_steps": ("INT", {"default": 25, "min": 1, "max": 10000, "step": 1}),
                "step_compensation": ("BOOLEAN", {"default": True}),
                "min_denoise": ("FLOAT", {"default": 0.20, "min": 0.0, "max": 1.0, "step": 0.01}),
                "max_denoise": ("FLOAT", {"default": 0.95, "min": 0.0, "max": 1.0, "step": 0.01}),
            },
            "optional": {
                "image": ("IMAGE",),
                "vae": ("VAE",),
                "pipe": ("PIPE",),
                "mask": ("MASK",),
            }
        }

    CATEGORY = "ModusFlow/Latent"
    RETURN_TYPES = ("LATENT", "FLOAT", "INT", "IMAGE", "PIPE", "STRING")
    RETURN_NAMES = ("latent", "denoise", "steps", "image", "pipe", "summary")
    FUNCTION = "process"

    def process(self, image_upload, fidelity, preset, target_model, alignment, resize_mode, curve, base_steps,
                step_compensation, min_denoise, max_denoise, image=None, vae=None, pipe=None, mask=None):

        # Resolve VAE
        resolved_vae = vae
        if resolved_vae is None and pipe is not None and len(pipe) > 2:
            resolved_vae = pipe[2]

        if resolved_vae is None:
            raise ValueError("[ModusFlow Img2Img VAE Encode] VAE is required (provide via 'vae' input or 'pipe').")

        # Resolve Image: external image input takes priority over uploaded image
        img_tensor = image
        if img_tensor is None and image_upload and image_upload != "none":
            image_path = folder_paths.get_annotated_filepath(image_upload)
            if os.path.exists(image_path):
                i = Image.open(image_path)
                i = ImageOps.exif_transpose(i).convert("RGB")
                img_np = np.array(i).astype(np.float32) / 255.0
                img_tensor = torch.from_numpy(img_np)[None,]

        if img_tensor is None:
            raise ValueError("[ModusFlow Img2Img VAE Encode] IMAGE is required (connect 'image' or choose an uploaded file).")

        # Alignment
        target_align = alignment
        if alignment.startswith("Auto"):
            if "Chroma" in target_model or "Flux" in target_model:
                target_align = "Divisible by 16 (Flux / Chroma)"
            else:
                target_align = "Divisible by 8 (SDXL / Pony / Illustrious / SD 1.5)"

        aligned_image = _align_image_tensor(img_tensor, target_align, resize_mode)
        _, h, w, _ = aligned_image.shape

        # Encode to Latent
        latent_tensor = resolved_vae.encode(aligned_image[:, :, :, :3])
        latent_dict = {"samples": latent_tensor, "width": w, "height": h}

        if mask is not None:
            lat_h = latent_tensor.shape[-2]
            lat_w = latent_tensor.shape[-1]
            m = mask.unsqueeze(1)
            m_resized = F.interpolate(m, size=(lat_h, lat_w), mode="bilinear", align_corners=False)
            latent_dict["noise_mask"] = m_resized.squeeze(1)

        # Fidelity calculation
        active_fidelity = fidelity
        if preset == "Replica + Style / LoRA (90% Fidelity)":
            active_fidelity = 90.0
        elif preset == "Faithful Restyle (75% Fidelity)":
            active_fidelity = 75.0
        elif preset == "Balanced Reimagining (50% Fidelity)":
            active_fidelity = 50.0
        elif preset == "Creative Divergence (25% Fidelity)":
            active_fidelity = 25.0
        elif preset == "Barely Recognizable (10% Fidelity)":
            active_fidelity = 10.0

        denoise, steps, _, summary = _compute_fidelity_mapping(
            fidelity_pct=active_fidelity,
            curve=curve,
            min_denoise=min_denoise,
            max_denoise=max_denoise,
            base_steps=base_steps,
            step_compensation=step_compensation,
            target_model=target_model
        )

        return (latent_dict, denoise, steps, aligned_image, pipe, summary)
