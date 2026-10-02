import torch
import numpy as np
from PIL import Image, ImageFilter, ImageOps

class ModusFlowImagePreprocessor:
    """
    Essential zero-dependency image preprocessor for ControlNet guidance.
    Provides fast, local preprocessing (Canny Edge, LineArt, Color Map, Blur/Tile, Luminance Proxy)
    without requiring heavy 3rd-party auxiliary models.
    """

    PREPROCESSORS = [
        "Canny Edge",
        "LineArt (Adaptive Threshold)",
        "Color / Palette Guidance",
        "Blur / Tile (Low-Res Guide)",
        "Luminance / Depth Proxy",
    ]

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "image": ("IMAGE",),
                "preprocessor": (cls.PREPROCESSORS, {"default": "Canny Edge"}),
                "low_threshold": ("INT", {"default": 100, "min": 0, "max": 255, "step": 1}),
                "high_threshold": ("INT", {"default": 200, "min": 0, "max": 255, "step": 1}),
                "blur_radius": ("FLOAT", {"default": 4.0, "min": 0.0, "max": 64.0, "step": 0.5}),
                "invert": ("BOOLEAN", {"default": False}),
            }
        }

    RETURN_TYPES = ("IMAGE",)
    RETURN_NAMES = ("image",)
    FUNCTION = "preprocess_image"
    CATEGORY = "ModusFlow/Conditioning"

    def preprocess_image(self, image: torch.Tensor, preprocessor: str, low_threshold: int, high_threshold: int, blur_radius: float, invert: bool):
        # image is [B, H, W, C] float32 in [0, 1]
        out_tensors = []

        try:
            import cv2
            has_cv2 = True
        except ImportError:
            has_cv2 = False

        for b in range(image.shape[0]):
            img_np = (image[b].cpu().numpy() * 255.0).clip(0, 255).astype(np.uint8)
            h, w, c = img_np.shape

            if preprocessor == "Canny Edge":
                if has_cv2:
                    gray = cv2.cvtColor(img_np, cv2.COLOR_RGB2GRAY)
                    if blur_radius > 0:
                        ksize = int(blur_radius) * 2 + 1
                        gray = cv2.GaussianBlur(gray, (ksize, ksize), 0)
                    edges = cv2.Canny(gray, low_threshold, high_threshold)
                    if invert:
                        edges = 255 - edges
                    res = cv2.cvtColor(edges, cv2.COLOR_GRAY2RGB)
                else:
                    pil_img = Image.fromarray(img_np).convert("L")
                    if blur_radius > 0:
                        pil_img = pil_img.filter(ImageFilter.GaussianBlur(blur_radius / 2))
                    edges = pil_img.filter(ImageFilter.FIND_EDGES)
                    edges_np = np.array(edges)
                    edges_np = np.where(edges_np > low_threshold, 255, 0).astype(np.uint8)
                    if invert:
                        edges_np = 255 - edges_np
                    res = np.stack([edges_np] * 3, axis=-1)

            elif preprocessor == "LineArt (Adaptive Threshold)":
                if has_cv2:
                    gray = cv2.cvtColor(img_np, cv2.COLOR_RGB2GRAY)
                    if blur_radius > 0:
                        ksize = int(blur_radius) * 2 + 1
                        gray = cv2.medianBlur(gray, ksize)
                    lineart = cv2.adaptiveThreshold(
                        gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
                        cv2.THRESH_BINARY_INV if not invert else cv2.THRESH_BINARY,
                        11, 2
                    )
                    res = cv2.cvtColor(lineart, cv2.COLOR_GRAY2RGB)
                else:
                    pil_img = Image.fromarray(img_np).convert("L")
                    pil_edges = pil_img.filter(ImageFilter.CONTOUR)
                    if invert:
                        pil_edges = ImageOps.invert(pil_edges)
                    res = np.array(pil_edges.convert("RGB"))

            elif preprocessor == "Color / Palette Guidance":
                pil_img = Image.fromarray(img_np)
                if blur_radius > 0:
                    pil_img = pil_img.filter(ImageFilter.GaussianBlur(blur_radius * 2))
                # Optional color quantization
                res = np.array(pil_img)
                if invert:
                    res = 255 - res

            elif preprocessor == "Blur / Tile (Low-Res Guide)":
                pil_img = Image.fromarray(img_np)
                # Downsample to 1/4th and upscale back
                small_w = max(16, w // 4)
                small_h = max(16, h // 4)
                small = pil_img.resize((small_w, small_h), Image.Resampling.BILINEAR)
                blurred = small.resize((w, h), Image.Resampling.BILINEAR)
                if blur_radius > 0:
                    blurred = blurred.filter(ImageFilter.GaussianBlur(blur_radius))
                res = np.array(blurred)
                if invert:
                    res = 255 - res

            elif preprocessor == "Luminance / Depth Proxy":
                # Rec.709 luminance
                gray = (0.2126 * img_np[:, :, 0] + 0.7152 * img_np[:, :, 1] + 0.0722 * img_np[:, :, 2]).astype(np.uint8)
                if blur_radius > 0:
                    pil_gray = Image.fromarray(gray).filter(ImageFilter.GaussianBlur(blur_radius))
                    gray = np.array(pil_gray)
                if invert:
                    gray = 255 - gray
                res = np.stack([gray] * 3, axis=-1)

            else:
                res = img_np

            out_tensor = torch.from_numpy(res.astype(np.float32) / 255.0)
            out_tensors.append(out_tensor)

        final_batch = torch.stack(out_tensors, dim=0)
        return (final_batch,)

NODE_CLASS_MAPPINGS = {
    "ModusFlowImagePreprocessor": ModusFlowImagePreprocessor
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "ModusFlowImagePreprocessor": "ModusFlow Image Preprocessor"
}
