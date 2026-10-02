"""
ModusFlow Latent & Mask Tools

Provides:
- ModusFlowLatentUpscale: Latent upscaling for 2-pass hires-fix with PIPE support.
- ModusFlowMaskTools: Mask feathering, dilation/erosion, and inversion for inpainting.
"""

import torch
import torch.nn.functional as F
import numpy as np


class ModusFlowLatentUpscale:
    """
    Upscale latent tensors by multiplier (e.g. 1.25x, 1.5x, 2.0x) for 2-pass Hires Fix.
    """
    @classmethod
    def INPUT_TYPES(cls):
        methods = ["nearest-exact", "bilinear", "area", "bicubic", "bislerp"]
        return {
            "required": {
                "samples": ("LATENT",),
                "upscale_method": (methods, {"default": "bicubic"}),
                "scale_by": ("FLOAT", {"default": 1.5, "min": 0.1, "max": 8.0, "step": 0.05}),
            },
            "optional": {
                "pipe": ("PIPE",),
            }
        }

    RETURN_TYPES = ("LATENT", "INT", "INT", "PIPE")
    RETURN_NAMES = ("latent", "width", "height", "pipe")
    FUNCTION = "upscale"
    CATEGORY = "ModusFlow/Latent"

    def upscale(self, samples, upscale_method, scale_by, pipe=None):
        s = samples["samples"].clone()
        _, _, h, w = s.shape

        target_h = int(round(h * scale_by))
        target_w = int(round(w * scale_by))

        # Ensure spatial dimensions align to 2 for DiT / Flux patchify
        target_h = (target_h // 2) * 2
        target_w = (target_w // 2) * 2

        if upscale_method == "bislerp":
            try:
                import comfy.utils
                s = comfy.utils.bislerp(s, target_w, target_h)
            except Exception:
                s = F.interpolate(s, size=(target_h, target_w), mode="bicubic", align_corners=False)
        elif upscale_method in ("bilinear", "bicubic"):
            s = F.interpolate(s, size=(target_h, target_w), mode=upscale_method, align_corners=False)
        else:
            s = F.interpolate(s, size=(target_h, target_w), mode=upscale_method)

        pixel_w = target_w * 8
        pixel_h = target_h * 8

        out_latent = {"samples": s, "width": pixel_w, "height": pixel_h}
        return (out_latent, pixel_w, pixel_h, pipe)


class ModusFlowMaskTools:
    """
    Refine inpainting masks with grow/shrink, blur/feathering, and inversion.
    """
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "mask": ("MASK",),
                "grow_shrink": ("INT", {"default": 0, "min": -256, "max": 256, "step": 1}),
                "blur_radius": ("INT", {"default": 8, "min": 0, "max": 128, "step": 1}),
                "invert": ("BOOLEAN", {"default": False}),
            }
        }

    RETURN_TYPES = ("MASK", "IMAGE")
    RETURN_NAMES = ("mask", "preview_image")
    FUNCTION = "process"
    CATEGORY = "ModusFlow/Image"

    def process(self, mask, grow_shrink, blur_radius, invert):
        # mask shape: [B, H, W]
        m = mask.clone()

        if invert:
            m = 1.0 - m

        # Apply dilation / erosion (grow / shrink)
        if grow_shrink != 0:
            kernel_size = abs(grow_shrink) * 2 + 1
            pad = abs(grow_shrink)
            m_expanded = m.unsqueeze(1) # [B, 1, H, W]

            if grow_shrink > 0:
                # Dilation via max pooling
                m = F.max_pool2d(m_expanded, kernel_size=kernel_size, stride=1, padding=pad).squeeze(1)
            else:
                # Erosion via negated max pooling
                m = -F.max_pool2d(-m_expanded, kernel_size=kernel_size, stride=1, padding=pad).squeeze(1)

        # Apply Gaussian blur / feather
        if blur_radius > 0:
            k_size = blur_radius * 2 + 1
            sigma = max(0.1, blur_radius * 0.5)
            x = torch.arange(-blur_radius, blur_radius + 1, dtype=torch.float32, device=m.device)
            gauss_1d = torch.exp(-0.5 * (x / sigma) ** 2)
            gauss_1d = gauss_1d / gauss_1d.sum()
            kernel_2d = (gauss_1d[:, None] * gauss_1d[None, :]).unsqueeze(0).unsqueeze(0)

            m_in = m.unsqueeze(1)
            m = F.conv2d(m_in, kernel_2d, padding=blur_radius).squeeze(1)

        m = torch.clamp(m, 0.0, 1.0)
        # Create preview image [B, H, W, 3]
        preview = m.unsqueeze(-1).repeat(1, 1, 1, 3)

        return (m, preview)
