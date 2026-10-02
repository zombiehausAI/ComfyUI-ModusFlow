"""
ModusFlow ControlNet Nodes

Provides:
- ModusFlowControlNetLoader: Direct loading of ControlNet and T2I adapter models.
- ModusFlowControlNetApply: Pipe-aware ControlNet application with strength, start%, and end% scheduling.
"""

import folder_paths
import comfy.controlnet


class ModusFlowControlNetLoader:
    """Load a ControlNet or T2I-Adapter model by name."""
    @classmethod
    def INPUT_TYPES(cls):
        controlnets = folder_paths.get_filename_list("controlnet")
        return {
            "required": {
                "control_net_name": (sorted(controlnets) if controlnets else ["none"],),
            }
        }

    RETURN_TYPES = ("CONTROL_NET",)
    RETURN_NAMES = ("control_net",)
    FUNCTION = "load_controlnet"
    CATEGORY = "ModusFlow/Conditioning"

    def load_controlnet(self, control_net_name):
        if not control_net_name or control_net_name == "none":
            raise ValueError("[ModusFlow ControlNet Loader] No ControlNet model selected.")
        controlnet_path = folder_paths.get_annotated_filepath(control_net_name)
        controlnet = comfy.controlnet.load_controlnet(controlnet_path)
        return (controlnet,)


class ModusFlowControlNetApply:
    """
    Apply ControlNet guidance directly into ModusFlow conditioning or unified PIPE.
    """
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "image": ("IMAGE",),
                "strength": ("FLOAT", {"default": 1.0, "min": 0.0, "max": 10.0, "step": 0.01}),
                "start_percent": ("FLOAT", {"default": 0.0, "min": 0.0, "max": 1.0, "step": 0.01}),
                "end_percent": ("FLOAT", {"default": 1.0, "min": 0.0, "max": 1.0, "step": 0.01}),
            },
            "optional": {
                "control_net": ("CONTROL_NET",),
                "pipe": ("PIPE",),
                "positive": ("CONDITIONING",),
                "negative": ("CONDITIONING",),
            }
        }

    RETURN_TYPES = ("CONDITIONING", "CONDITIONING", "PIPE")
    RETURN_NAMES = ("positive", "negative", "pipe")
    FUNCTION = "apply_controlnet"
    CATEGORY = "ModusFlow/Conditioning"

    def apply_controlnet(self, image, strength, start_percent, end_percent,
                         control_net=None, pipe=None, positive=None, negative=None):

        # Extract conditioning and components from pipe if present
        model = None
        clip = None
        vae = None
        if pipe is not None and len(pipe) >= 5:
            model = pipe[0]
            clip = pipe[1]
            vae = pipe[2]
            positive = positive if positive is not None else pipe[3]
            negative = negative if negative is not None else pipe[4]

        if positive is None:
            raise ValueError("[ModusFlow ControlNet Apply] POSITIVE conditioning is required (provide directly or via pipe).")

        # Bypass if control_net is not provided or strength is 0
        if control_net is None or strength <= 0.0:
            out_pipe = (model, clip, vae, positive, negative) if pipe is not None else None
            return (positive, negative, out_pipe)

        # Apply controlnet to positive conditioning
        pos_out = []
        for t in positive:
            d = t[1].copy()
            prev_cnet = d.get("control", None)
            cnet = control_net.copy().set_cond_hint(image, strength, (start_percent, end_percent))
            cnet.set_previous_controlnet(prev_cnet)
            d["control"] = cnet
            d["control_apply_to_uncond"] = False
            pos_out.append([t[0], d])

        neg_out = negative
        out_pipe = (model, clip, vae, pos_out, neg_out) if pipe is not None else None
        return (pos_out, neg_out, out_pipe)


class ModusFlowControlNetAllInOne:
    """
    All-in-One ControlNet loader, preprocessor, and pipe-aware applicator.
    Loads ControlNet models directly, handles pre-made stick figures or raw image preprocessing,
    and applies guidance into ModusFlow conditioning or pipe with scheduling.
    """

    PREPROCESSORS = [
        "None (Direct / Stick Image)",
        "Canny Edge",
        "LineArt (Adaptive Threshold)",
        "Color / Palette Guidance",
        "Blur / Tile (Low-Res Guide)",
        "Luminance / Depth Proxy",
    ]

    _model_cache = {}

    @classmethod
    def INPUT_TYPES(cls):
        controlnets = folder_paths.get_filename_list("controlnet")
        controlnet_list = ["None / Bypass"] + sorted(controlnets)
        return {
            "required": {
                "control_net_name": (controlnet_list, {"default": "None / Bypass"}),
                "preprocessor": (cls.PREPROCESSORS, {"default": "None (Direct / Stick Image)"}),
                "strength": ("FLOAT", {"default": 1.0, "min": 0.0, "max": 10.0, "step": 0.01}),
                "start_percent": ("FLOAT", {"default": 0.0, "min": 0.0, "max": 1.0, "step": 0.01}),
                "end_percent": ("FLOAT", {"default": 1.0, "min": 0.0, "max": 1.0, "step": 0.01}),
            },
            "optional": {
                "image": ("IMAGE",),
                "pipe": ("PIPE",),
                "positive": ("CONDITIONING",),
                "negative": ("CONDITIONING",),
                "low_threshold": ("INT", {"default": 100, "min": 0, "max": 255, "step": 1}),
                "high_threshold": ("INT", {"default": 200, "min": 0, "max": 255, "step": 1}),
            }
        }

    RETURN_TYPES = ("PIPE", "CONDITIONING", "CONDITIONING", "IMAGE")
    RETURN_NAMES = ("pipe", "positive", "negative", "preprocessed_image")
    FUNCTION = "apply_all_in_one"
    CATEGORY = "ModusFlow/Conditioning"

    def apply_all_in_one(self, control_net_name, preprocessor, strength, start_percent, end_percent,
                         image=None, pipe=None, positive=None, negative=None,
                         low_threshold=100, high_threshold=200):
        # Extract components from pipe
        model = None
        clip = None
        vae = None
        if pipe is not None and len(pipe) >= 5:
            model = pipe[0]
            clip = pipe[1]
            vae = pipe[2]
            positive = positive if positive is not None else pipe[3]
            negative = negative if negative is not None else pipe[4]

        # Preprocess the guide image if provided
        hint_image = image
        if image is not None and preprocessor != "None (Direct / Stick Image)":
            try:
                from .controlnet_preprocessor_node import ModusFlowImagePreprocessor
                prep = ModusFlowImagePreprocessor()
                hint_image = prep.preprocess_image(
                    image=image,
                    preprocessor=preprocessor,
                    low_threshold=low_threshold,
                    high_threshold=high_threshold,
                    blur_radius=4.0,
                    invert=False
                )[0]
            except Exception as e:
                print(f"[ModusFlowControlNetAllInOne] Preprocessor warning: {e}. Using raw image.")
                hint_image = image

        # Bypass condition
        is_bypass = (
            control_net_name == "None / Bypass" or
            control_net_name == "none" or
            strength <= 0.0 or
            hint_image is None or
            positive is None
        )

        if is_bypass:
            out_pipe = (model, clip, vae, positive, negative) if pipe is not None else None
            return (out_pipe, positive, negative, hint_image if hint_image is not None else image)

        # Load / retrieve ControlNet model from cache
        if control_net_name not in self._model_cache:
            controlnet_path = folder_paths.get_annotated_filepath(control_net_name)
            self._model_cache[control_net_name] = comfy.controlnet.load_controlnet(controlnet_path)
        control_net = self._model_cache[control_net_name]

        # Apply ControlNet to positive conditioning
        pos_out = []
        for t in positive:
            d = t[1].copy()
            prev_cnet = d.get("control", None)
            cnet = control_net.copy().set_cond_hint(hint_image, strength, (start_percent, end_percent))
            cnet.set_previous_controlnet(prev_cnet)
            d["control"] = cnet
            d["control_apply_to_uncond"] = False
            pos_out.append([t[0], d])

        out_pipe = (model, clip, vae, pos_out, negative) if pipe is not None else None
        return (out_pipe, pos_out, negative, hint_image)
