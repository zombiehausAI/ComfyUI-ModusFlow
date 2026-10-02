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
