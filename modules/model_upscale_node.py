import torch
import torch.nn.functional as F
import folder_paths


class ModusFlowModelUpscale:
    """
    All-in-one Model Upscaler with independent bypass options for upscale and downscale.
    Combines model loading (e.g. 4x-UltraSharp), model inference, and interpolation downscaling
    (e.g. 0.5x to produce a pristine 2x super-resolution result) with pipe pass-through.
    """

    @classmethod
    def INPUT_TYPES(cls):
        try:
            upscale_models = folder_paths.get_filename_list("upscale_models")
            upscale_models = ["None"] + sorted(upscale_models)
        except Exception:
            upscale_models = ["None"]

        methods = ["lanczos", "bicubic", "bilinear", "area", "nearest-exact"]

        return {
            "required": {
                "image": ("IMAGE",),
                "upscale_model_name": (upscale_models, {"default": upscale_models[0] if upscale_models else "None"}),
                "upscale_enabled": ("BOOLEAN", {"default": True}),
                "downscale_enabled": ("BOOLEAN", {"default": True}),
                "scale_down_by": ("FLOAT", {"default": 0.5, "min": 0.05, "max": 2.0, "step": 0.05}),
                "rescale_method": (methods, {"default": "lanczos"}),
            },
            "optional": {
                "pipe": ("PIPE",),
            },
        }

    RETURN_TYPES = ("IMAGE", "PIPE",)
    RETURN_NAMES = ("image", "pipe",)
    FUNCTION = "upscale_and_rescale"
    CATEGORY = "ModusFlow/Image"

    @staticmethod
    def _rescale_tensor(image: torch.Tensor, scale: float, method: str) -> torch.Tensor:
        """Rescale tensor (B, H, W, C) by a multiplier using specified interpolation method."""
        if abs(scale - 1.0) < 1e-4 or scale <= 0.0:
            return image

        B, H, W, C = image.shape
        new_h = max(1, int(round(H * scale)))
        new_w = max(1, int(round(W * scale)))

        try:
            import comfy.utils
            img_ch = image.movedim(-1, 1)
            rescaled = comfy.utils.common_upscale(img_ch, new_w, new_h, method, "disabled")
            return rescaled.movedim(1, -1)
        except Exception:
            img_ch = image.permute(0, 3, 1, 2)
            torch_mode = "bicubic" if method in ("bicubic", "lanczos") else ("bilinear" if method == "bilinear" else ("area" if method == "area" else "nearest"))
            align_corners = torch_mode in ("bilinear", "bicubic")
            kwargs = {}
            if align_corners:
                kwargs["align_corners"] = False
            if torch_mode in ("bilinear", "bicubic"):
                kwargs["antialias"] = True
            rescaled = F.interpolate(img_ch, size=(new_h, new_w), mode=torch_mode, **kwargs)
            return rescaled.permute(0, 2, 3, 1).clamp(0.0, 1.0)

    def upscale_and_rescale(self, image, upscale_model_name, upscale_enabled=True,
                            downscale_enabled=True, scale_down_by=0.5, rescale_method="lanczos",
                            pipe=None):
        current_img = image

        # 1. Model Upscale Pass
        if upscale_enabled and upscale_model_name and upscale_model_name != "None":
            try:
                from comfy_extras.nodes_upscale_model import UpscaleModelLoader, ImageUpscaleWithModel
                loader = UpscaleModelLoader()
                model = loader.load_model(upscale_model_name)[0]
                upscaler = ImageUpscaleWithModel()
                current_img = upscaler.upscale(model, current_img)[0]
            except Exception as e:
                print(f"[ModusFlowModelUpscale] Upscale model warning: {e}. Falling back to input image.")

        # 2. Downscale / Rescale Pass
        if downscale_enabled and scale_down_by > 0.0 and abs(scale_down_by - 1.0) > 1e-4:
            current_img = self._rescale_tensor(current_img, scale_down_by, rescale_method)

        return (current_img, pipe)
