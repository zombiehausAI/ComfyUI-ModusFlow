"""
ModusFlow Dynamic Guidance Node

Sampling-level dynamic guidance hook that adjusts guidance scale over timesteps
to combat plastic, waxy skin tones and over-saturation without requiring LoRAs.
Supports Flux, ChromaHD-1, SD3, and standard diffusion models.
"""

import math
import torch


class ModusDynamicGuidance:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "scale_start": ("FLOAT", {"default": 3.5, "min": 0.5, "max": 15.0, "step": 0.1, "round": 0.01}),
                "scale_end": ("FLOAT", {"default": 1.8, "min": 0.5, "max": 10.0, "step": 0.1, "round": 0.01}),
                "decay_power": ("FLOAT", {"default": 1.0, "min": 0.1, "max": 4.0, "step": 0.1, "round": 0.01}),
                "decay_profile": (["linear", "cosine", "exponential"], {"default": "linear"}),
            },
            "optional": {
                "pipe": ("PIPE",),
                "model": ("MODEL",),
            }
        }

    RETURN_TYPES = ("MODEL", "PIPE")
    RETURN_NAMES = ("model", "pipe")
    FUNCTION = "apply_dynamic_guidance"
    CATEGORY = "ModusFlow/Sampling"

    def apply_dynamic_guidance(self, scale_start, scale_end, decay_power, decay_profile,
                               pipe=None, model=None):
        clip = None
        vae = None
        positive = None
        negative = None

        if pipe is not None:
            # Pipe format: (model, clip, vae, positive, negative)
            model = model if model is not None else (pipe[0] if len(pipe) > 0 else None)
            clip = pipe[1] if len(pipe) > 1 else None
            vae = pipe[2] if len(pipe) > 2 else None
            positive = pipe[3] if len(pipe) > 3 else None
            negative = pipe[4] if len(pipe) > 4 else None

        if model is None:
            raise ValueError("[ModusDynamicGuidance] MODEL is required (provide via pipe or individual model input)")

        m = model.clone()

        # Chain-safety: preserve existing wrapper if present
        existing_wrapper = None
        if hasattr(m, "model_options") and isinstance(m.model_options, dict):
            existing_wrapper = m.model_options.get("model_function_wrapper", None)

        def dynamic_guidance_wrapper(apply_model, params):
            # Extract timestep from params
            t = params.get("timestep", None)
            if t is None:
                t_val = 0.0
            elif isinstance(t, torch.Tensor):
                t_val = float(t.flatten()[0].item())
            else:
                try:
                    t_val = float(t)
                except (TypeError, ValueError):
                    t_val = 0.0

            # Normalize timestep:
            # Handle float timesteps (1.0 -> 0.0 for flow/rectified models like Flux / ChromaHD-1)
            # and integer scales (e.g. 999 -> 0 or 1000 -> 0)
            if t_val > 1.0:
                t_norm = t_val / (1000.0 if t_val > 999.0 else 999.0)
            else:
                t_norm = t_val
            t_norm = max(0.0, min(1.0, float(t_norm)))

            # Compute decay factor based on selected profile
            # factor = 1.0 at start of sampling (high t), 0.0 at end (low t)
            if decay_profile == "cosine":
                cos_val = 0.5 * (1.0 - math.cos(math.pi * t_norm))
                factor = cos_val ** decay_power
            elif decay_profile == "exponential":
                if abs(decay_power) < 1e-5:
                    factor = t_norm
                else:
                    exp_max = math.exp(min(decay_power, 20.0)) - 1.0
                    exp_curr = math.exp(min(decay_power * t_norm, 20.0)) - 1.0
                    factor = exp_curr / exp_max if exp_max != 0 else t_norm
            else:  # "linear"
                factor = t_norm ** decay_power

            factor = max(0.0, min(1.0, factor))
            current_scale = scale_end + (scale_start - scale_end) * factor

            # Cross-model handling for conditioning
            c = params.get("c", None)
            if isinstance(c, dict):
                # Flux / SD3 style guidance tensor in c conditioning
                if "guidance" in c:
                    orig_guidance = c["guidance"]
                    if isinstance(orig_guidance, torch.Tensor):
                        c["guidance"] = torch.full_like(orig_guidance, current_scale)
                    else:
                        c["guidance"] = current_scale
                elif "transformer_options" in c and isinstance(c["transformer_options"], dict):
                    if "guidance" in c["transformer_options"]:
                        orig_guidance = c["transformer_options"]["guidance"]
                        if isinstance(orig_guidance, torch.Tensor):
                            c["transformer_options"]["guidance"] = torch.full_like(orig_guidance, current_scale)
                        else:
                            c["transformer_options"]["guidance"] = current_scale
                elif "cfg" in c:
                    orig_cfg = c["cfg"]
                    if isinstance(orig_cfg, torch.Tensor):
                        c["cfg"] = torch.full_like(orig_cfg, current_scale)
                    else:
                        c["cfg"] = current_scale

            # Forward execution preserving any existing outer wrapper or calling apply_model
            if existing_wrapper is not None:
                return existing_wrapper(apply_model, params)
            return apply_model(params["input"], params["timestep"], **params["c"])

        m.set_model_unet_function_wrapper(dynamic_guidance_wrapper)
        output_pipe = (m, clip, vae, positive, negative) if pipe is not None else (m, None, None, None, None)
        return (m, output_pipe)


NODE_CLASS_MAPPINGS = {
    "ModusDynamicGuidance": ModusDynamicGuidance
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "ModusDynamicGuidance": "Modus Dynamic Guidance"
}
