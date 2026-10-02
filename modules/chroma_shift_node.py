"""
ModusFlow Chroma Shift Node

Applies resolution-dependent Flow-Matching timestep shifting for Chroma 1-HD and FLUX models.
Ensures continuous flow schedules match the spatial token count for sharp micro-details
and fast convergence across all aspect ratios, with pipe awareness and latent auto-detection.
"""

import math
import torch


class ModusFlowChromaShift:
    """
    Resolution Timestep Shift for Chroma 1-HD and FLUX.
    Automatically scales base and max shift to image/latent dimensions.
    """

    @classmethod
    def INPUT_TYPES(cls):
        modes = [
            "Auto (from Latent / Image)",
            "Manual Resolution",
            "Fixed Shift",
            "Bypass",
        ]

        return {
            "required": {
                "max_shift": ("FLOAT", {"default": 1.15, "min": 0.0, "max": 100.0, "step": 0.01}),
                "base_shift": ("FLOAT", {"default": 0.5, "min": 0.0, "max": 100.0, "step": 0.01}),
                "width": ("INT", {"default": 1024, "min": 64, "max": 8192, "step": 8}),
                "height": ("INT", {"default": 1024, "min": 64, "max": 8192, "step": 8}),
                "mode": (modes, {"default": "Auto (from Latent / Image)"}),
                "fixed_shift": ("FLOAT", {"default": 1.0, "min": 0.0, "max": 10.0, "step": 0.05}),
            },
            "optional": {
                "pipe": ("PIPE",),
                "model": ("MODEL",),
                "latent": ("LATENT",),
                "image": ("IMAGE",),
            },
        }

    RETURN_TYPES = ("MODEL", "PIPE",)
    RETURN_NAMES = ("model", "pipe",)
    FUNCTION = "apply_shift"
    CATEGORY = "ModusFlow/Sampling"

    def apply_shift(self, max_shift, base_shift, width, height, mode="Auto (from Latent / Image)",
                    fixed_shift=1.0, pipe=None, model=None, latent=None, image=None):
        clip = None
        vae = None
        positive = None
        negative = None

        if pipe is not None:
            model = model if model is not None else (pipe[0] if len(pipe) > 0 else None)
            clip = pipe[1] if len(pipe) > 1 else None
            vae = pipe[2] if len(pipe) > 2 else None
            positive = pipe[3] if len(pipe) > 3 else None
            negative = pipe[4] if len(pipe) > 4 else None

        if model is None:
            raise ValueError("[ModusFlowChromaShift] MODEL is required (connect via pipe or individual model input)")

        if mode == "Bypass":
            output_pipe = (model, clip, vae, positive, negative) if pipe is not None else (model, None, None, None, None)
            return (model, output_pipe)

        # Determine effective dimensions
        w = width
        h = height

        if mode == "Auto (from Latent / Image)":
            if latent is not None and isinstance(latent, dict):
                if "width" in latent and "height" in latent:
                    w = int(latent["width"])
                    h = int(latent["height"])
                elif "samples" in latent and isinstance(latent["samples"], torch.Tensor):
                    shape = latent["samples"].shape
                    h = shape[-2] * 8
                    w = shape[-1] * 8
            elif image is not None and isinstance(image, torch.Tensor):
                h = image.shape[1]
                w = image.shape[2]

        m = model.clone()

        if mode == "Fixed Shift":
            # Apply fixed constant shift
            try:
                import comfy.model_sampling
                m = self._patch_constant_shift(m, fixed_shift)
            except Exception as e:
                print(f"[ModusFlowChromaShift] Fixed shift error: {e}")
        else:
            # Apply Flux / Chroma resolution-dependent shift
            try:
                from nodes import ModelSamplingFlux
                m = ModelSamplingFlux().patch(m, max_shift, base_shift, w, h)[0]
            except Exception:
                try:
                    import comfy.model_sampling
                    x = (w * h) / (1024.0 * 1024.0)
                    slope = (max_shift - base_shift) / 3.0
                    shift = slope * (x - 1.0) + base_shift
                    m = self._patch_constant_shift(m, shift)
                except Exception as e:
                    print(f"[ModusFlowChromaShift] Timestep shift warning: {e}")

        output_pipe = (m, clip, vae, positive, negative) if pipe is not None else (m, None, None, None, None)
        return (m, output_pipe)

    def _patch_constant_shift(self, model, shift_val):
        """Helper to patch a model with a continuous constant shift."""
        try:
            sampling_base = model.model.model_sampling.__class__
            class ModelSamplingShift(sampling_base):
                def __init__(self, *args, **kwargs):
                    super().__init__(*args, **kwargs)
                    self.set_shift(shift_val)

            model.add_object_patch("model_sampling", ModelSamplingShift(model.model.model_config))
        except Exception:
            pass
        return model
