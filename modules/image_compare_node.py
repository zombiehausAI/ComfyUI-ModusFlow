"""
ModusFlow Image Compare Node

Provides interactive/split comparison between two images (Before vs After)
for evaluating DeWax, Restormers, Detailers, and Upscalers.
"""

import torch
import torch.nn.functional as F


class ModusFlowCompareImages:
    """
    Split comparison between Image A (Before) and Image B (After) with adjustable divider.
    """
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "image_a": ("IMAGE",),
                "image_b": ("IMAGE",),
                "split_percent": ("FLOAT", {"default": 50.0, "min": 0.0, "max": 100.0, "step": 1.0, "display": "slider"}),
                "split_direction": (["Vertical (Left/Right)", "Horizontal (Top/Bottom)"], {"default": "Vertical (Left/Right)"}),
                "show_divider": ("BOOLEAN", {"default": True}),
            }
        }

    RETURN_TYPES = ("IMAGE", "IMAGE", "IMAGE")
    RETURN_NAMES = ("comparison", "image_a", "image_b")
    FUNCTION = "compare"
    CATEGORY = "ModusFlow/Image"

    def compare(self, image_a, image_b, split_percent, split_direction, show_divider):
        # Match dimensions if they differ
        a = image_a.clone()
        b = image_b.clone()

        _, ha, wa, _ = a.shape
        _, hb, wb, _ = b.shape

        if (ha, wa) != (hb, wb):
            # Rescale B to match A
            b_perm = b.permute(0, 3, 1, 2)
            b_perm = F.interpolate(b_perm, size=(ha, wa), mode="bilinear", align_corners=False)
            b = b_perm.permute(0, 2, 3, 1)

        result = a.clone()
        ratio = max(0.0, min(1.0, split_percent / 100.0))

        if split_direction.startswith("Vertical"):
            split_x = int(round(wa * ratio))
            # Left side is A, right side is B
            result[:, :, split_x:, :] = b[:, :, split_x:, :]
            if show_divider and 0 < split_x < wa:
                line_w = max(1, wa // 500)
                x_start = max(0, split_x - line_w)
                x_end = min(wa, split_x + line_w)
                result[:, :, x_start:x_end, :] = 1.0 # White line
        else:
            split_y = int(round(ha * ratio))
            # Top side is A, bottom side is B
            result[:, split_y:, :, :] = b[:, split_y:, :, :]
            if show_divider and 0 < split_y < ha:
                line_h = max(1, ha // 500)
                y_start = max(0, split_y - line_h)
                y_end = min(ha, split_y + line_h)
                result[:, y_start:y_end, :, :] = 1.0 # White line

        return (result, a, b)
