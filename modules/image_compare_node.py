"""
ModusFlow Image Compare Node

Provides interactive/split comparison between two images (Before vs After)
for evaluating DeWax, Restormers, Detailers, and Upscalers.
"""

import os
import random
import numpy as np
from PIL import Image
import torch
import torch.nn.functional as F
import folder_paths


class ModusFlowCompareImages:
    """
    Split comparison between Image A (Before) and Image B (After) with adjustable divider,
    featuring live on-canvas preview in ComfyUI.
    """
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "image_a": ("IMAGE",),
                "split_percent": ("FLOAT", {"default": 50.0, "min": 0.0, "max": 100.0, "step": 1.0, "display": "slider"}),
                "split_direction": (["Vertical (Left/Right)", "Horizontal (Top/Bottom)"], {"default": "Vertical (Left/Right)"}),
                "show_divider": ("BOOLEAN", {"default": True}),
            },
            "optional": {
                "image_b": ("IMAGE",),
            }
        }

    RETURN_TYPES = ("IMAGE", "IMAGE", "IMAGE")
    RETURN_NAMES = ("comparison", "image_a", "image_b")
    FUNCTION = "compare"
    OUTPUT_NODE = True
    CATEGORY = "ModusFlow/Image"

    def compare(self, image_a, split_percent=50.0, split_direction="Vertical (Left/Right)", show_divider=True, image_b=None):
        a = image_a.clone()

        if image_b is None:
            b = a.clone()
            result = a.clone()
        else:
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
                    result[:, :, x_start:x_end, :] = 1.0  # White line
            else:
                split_y = int(round(ha * ratio))
                # Top side is A, bottom side is B
                result[:, split_y:, :, :] = b[:, split_y:, :, :]
                if show_divider and 0 < split_y < ha:
                    line_h = max(1, ha // 500)
                    y_start = max(0, split_y - line_h)
                    y_end = min(ha, split_y + line_h)
                    result[:, y_start:y_end, :, :] = 1.0  # White line

        # Generate on-canvas UI preview images
        results = []
        try:
            temp_dir = folder_paths.get_temp_directory()
            prefix = "ModusFlow_Compare_" + "".join(random.choice("abcdefghijklmnopqrstuvwxyz") for _ in range(5))

            for batch_num in range(result.shape[0]):
                img_tensor = result[batch_num]
                w = int(img_tensor.shape[1])
                h = int(img_tensor.shape[0])
                full_output_folder, filename, counter, subfolder, _ = folder_paths.get_save_image_path(prefix, temp_dir, w, h)

                i = 255.0 * img_tensor.cpu().numpy()
                img = Image.fromarray(np.clip(i, 0, 255).astype(np.uint8))
                file = f"{filename}_{counter:05}_.png"
                output_path = os.path.join(full_output_folder, file)
                img.save(output_path, compress_level=1)
                results.append({
                    "filename": file,
                    "subfolder": subfolder.replace('\\', '/') if subfolder else "",
                    "type": "temp"
                })
        except Exception as e:
            print(f"[ModusFlowCompareImages] Warning: Failed to generate preview: {e}")

        return {"ui": {"images": results}, "result": (result, a, b)}

