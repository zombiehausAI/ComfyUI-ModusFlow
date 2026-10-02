import torch
import numpy as np
from PIL import Image, ImageFilter

class ModusFlowSmartResizer:
    """
    Aspect Ratio and Smart Resizer for diffusion models (ChromaHD, Flux, SDXL, SD1.5, Wan).
    Ensures optimal dimensions, multiples of 16/64, with center, top, or padded fitting.
    """

    ASPECT_RATIOS = [
        "1:1 Square (1024x1024)",
        "16:9 Landscape (1344x768)",
        "9:16 Portrait / Story (768x1344)",
        "4:5 Social Portrait (896x1152)",
        "3:4 Classic Portrait (864x1152)",
        "4:3 Classic Landscape (1152x864)",
        "21:9 Cinema UltraWide (1536x640)",
        "Original Aspect Ratio",
        "Custom Resolution",
    ]

    FIT_MODES = [
        "Center Crop",
        "Top / Focus Crop",
        "Bottom Crop",
        "Pad (Black)",
        "Pad (Edge Replicate)",
        "Stretch",
    ]

    RES_PRESETS = [
        "1024 (Flux / ChromaHD / SDXL)",
        "768 (Mid-Res / SD2)",
        "512 (SD 1.5)",
    ]

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "image": ("IMAGE",),
                "aspect_ratio": (cls.ASPECT_RATIOS, {"default": "1:1 Square (1024x1024)"}),
                "fit_mode": (cls.FIT_MODES, {"default": "Center Crop"}),
                "target_base": (cls.RES_PRESETS, {"default": "1024 (Flux / ChromaHD / SDXL)"}),
                "multiple_of": ([16, 64, 8], {"default": 16}),
            },
            "optional": {
                "custom_width": ("INT", {"default": 1024, "min": 64, "max": 8192, "step": 16}),
                "custom_height": ("INT", {"default": 1024, "min": 64, "max": 8192, "step": 16}),
            }
        }

    RETURN_TYPES = ("IMAGE", "INT", "INT", "STRING")
    RETURN_NAMES = ("image", "width", "height", "aspect_ratio_str")
    FUNCTION = "resize_image"
    CATEGORY = "ModusFlow/Utilities"

    def _get_target_dims(self, orig_w: int, orig_h: int, aspect_ratio: str, target_base_str: str, mult: int, custom_w: int, custom_h: int):
        base = 1024
        if "768" in target_base_str:
            base = 768
        elif "512" in target_base_str:
            base = 512

        ratio_map = {
            "1:1 Square (1024x1024)": (1, 1),
            "16:9 Landscape (1344x768)": (16, 9),
            "9:16 Portrait / Story (768x1344)": (9, 16),
            "4:5 Social Portrait (896x1152)": (4, 5),
            "3:4 Classic Portrait (864x1152)": (3, 4),
            "4:3 Classic Landscape (1152x864)": (4, 3),
            "21:9 Cinema UltraWide (1536x640)": (21, 9),
        }

        if aspect_ratio == "Custom Resolution":
            w = max(64, (custom_w // mult) * mult)
            h = max(64, (custom_h // mult) * mult)
            return w, h, f"{w}:{h}"

        if aspect_ratio == "Original Aspect Ratio":
            ar = orig_w / float(orig_h)
            # scale based on base total pixels ~ base * base
            total_px = base * base
            h = int(np.sqrt(total_px / ar))
            w = int(h * ar)
            w = max(64, (w // mult) * mult)
            h = max(64, (h // mult) * mult)
            return w, h, f"{orig_w}:{orig_h}"

        rw, rh = ratio_map.get(aspect_ratio, (1, 1))
        ar = rw / float(rh)
        total_px = base * base
        h = int(np.sqrt(total_px / ar))
        w = int(h * ar)
        w = max(64, (w // mult) * mult)
        h = max(64, (h // mult) * mult)
        return w, h, f"{rw}:{rh}"

    def resize_image(self, image: torch.Tensor, aspect_ratio: str, fit_mode: str, target_base: str, multiple_of: int, custom_width: int = 1024, custom_height: int = 1024):
        # image is [B, H, W, C]
        b_size, in_h, in_w, in_c = image.shape
        out_w, out_h, ar_str = self._get_target_dims(in_w, in_h, aspect_ratio, target_base, multiple_of, custom_width, custom_height)

        out_tensors = []
        for b in range(b_size):
            img_np = (image[b].cpu().numpy() * 255.0).clip(0, 255).astype(np.uint8)
            pil_img = Image.fromarray(img_np)

            if fit_mode == "Stretch":
                res = pil_img.resize((out_w, out_h), Image.Resampling.LANCZOS)

            elif fit_mode.startswith("Pad"):
                # Fit within out_w, out_h preserving aspect ratio
                in_ar = in_w / float(in_h)
                target_ar = out_w / float(out_h)

                if in_ar > target_ar:
                    # Width bound
                    scale_w = out_w
                    scale_h = max(1, int(out_w / in_ar))
                else:
                    scale_h = out_h
                    scale_w = max(1, int(out_h * in_ar))

                scaled = pil_img.resize((scale_w, scale_h), Image.Resampling.LANCZOS)
                canvas = Image.new("RGB", (out_w, out_h), (0, 0, 0))

                if fit_mode == "Pad (Edge Replicate)":
                    bg = pil_img.resize((out_w, out_h), Image.Resampling.BILINEAR)
                    bg = bg.filter(ImageFilter.GaussianBlur(16))
                    canvas.paste(bg, (0, 0))

                offset_x = (out_w - scale_w) // 2
                offset_y = (out_h - scale_h) // 2
                canvas.paste(scaled, (offset_x, offset_y))
                res = canvas

            else: # Crops
                # Scale so image covers out_w, out_h
                in_ar = in_w / float(in_h)
                target_ar = out_w / float(out_h)

                if in_ar > target_ar:
                    # Height bound
                    scale_h = out_h
                    scale_w = max(1, int(out_h * in_ar))
                else:
                    scale_w = out_w
                    scale_h = max(1, int(out_w / in_ar))

                scaled = pil_img.resize((scale_w, scale_h), Image.Resampling.LANCZOS)

                if fit_mode == "Top / Focus Crop":
                    crop_x = (scale_w - out_w) // 2
                    crop_y = 0
                elif fit_mode == "Bottom Crop":
                    crop_x = (scale_w - out_w) // 2
                    crop_y = scale_h - out_h
                else: # Center Crop
                    crop_x = (scale_w - out_w) // 2
                    crop_y = (scale_h - out_h) // 2

                res = scaled.crop((crop_x, crop_y, crop_x + out_w, crop_y + out_h))

            out_np = np.array(res).astype(np.float32) / 255.0
            out_tensors.append(torch.from_numpy(out_np))

        final_tensor = torch.stack(out_tensors, dim=0)
        return (final_tensor, out_w, out_h, ar_str)

NODE_CLASS_MAPPINGS = {
    "ModusFlowSmartResizer": ModusFlowSmartResizer
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "ModusFlowSmartResizer": "ModusFlow Smart Resizer"
}
