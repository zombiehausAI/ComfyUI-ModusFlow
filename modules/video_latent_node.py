"""
ModusFlow Video Latent Node

Unified latent generator for video models (Wan 2.1, HunyuanVideo, LTX-Video, SVD).
Supports both Text-to-Video (T2V) and Image-to-Video (I2V) in a single node:
- In T2V mode: Generates an empty spatio-temporal 5D latent tensor.
- In I2V mode: Encodes the starting image into the first frame and pre-populates the video latent timeline.
- Includes quick-toggle to enable/disable image input without rewiring nodes.
"""

import torch
import torch.nn.functional as F


class ModusFlowVideoLatent:
    """
    Generate video latents with resolution presets, frame counts,
    and unified Text-to-Video (T2V) or Image-to-Video (I2V) conditioning.
    """

    @classmethod
    def INPUT_TYPES(cls):
        model_types = [
            "Wan 2.1 (16ch, 4x time)",
            "HunyuanVideo (16ch, 4x time)",
            "LTX-Video (128ch, 8x time)",
            "Standard / SVD (4ch, 1x time)",
        ]

        resolution_presets = [
            "832x480 (16:9 Landscape)",
            "480x832 (9:16 Portrait)",
            "640x480 (4:3 Landscape)",
            "480x640 (3:4 Portrait)",
            "1280x720 (720p 16:9)",
            "720x1280 (720p 9:16)",
            "960x720 (720p 4:3)",
            "Manual",
        ]

        frame_presets = [
            "81 frames (~5 sec @ 16fps)",
            "49 frames (~3 sec @ 16fps)",
            "33 frames (~2 sec @ 16fps)",
            "17 frames (~1 sec @ 16fps)",
            "Manual",
        ]

        modes = [
            "Image to Video (I2V)",
            "Text to Video (T2V)",
        ]

        return {
            "required": {
                "mode": (modes, {"default": "Image to Video (I2V)"}),
                "model_type": (model_types, {"default": "Wan 2.1 (16ch, 4x time)"}),
                "resolution": (resolution_presets, {"default": "832x480 (16:9 Landscape)"}),
                "width": ("INT", {"default": 832, "min": 64, "max": 4096, "step": 16}),
                "height": ("INT", {"default": 480, "min": 64, "max": 4096, "step": 16}),
                "frames": (frame_presets, {"default": "81 frames (~5 sec @ 16fps)"}),
                "length": ("INT", {"default": 81, "min": 1, "max": 1000, "step": 4}),
                "batch_size": ("INT", {"default": 1, "min": 1, "max": 16, "step": 1}),
            },
            "optional": {
                "image": ("IMAGE",),
                "pipe": ("PIPE",),
                "vae": ("VAE",),
            },
        }

    RETURN_TYPES = ("LATENT", "PIPE", "INT", "INT", "INT",)
    RETURN_NAMES = ("latent", "pipe", "width", "height", "length",)
    FUNCTION = "generate_latent"
    CATEGORY = "ModusFlow/Latent"

    def generate_latent(self, mode, model_type, resolution, width, height, frames, length, batch_size,
                        image=None, pipe=None, vae=None):
        # 1. Resolve resolution preset
        preset_map = {
            "832x480 (16:9 Landscape)": (832, 480),
            "480x832 (9:16 Portrait)": (480, 832),
            "640x480 (4:3 Landscape)": (640, 480),
            "480x640 (3:4 Portrait)": (480, 640),
            "1280x720 (720p 16:9)": (1280, 720),
            "720x1280 (720p 9:16)": (720, 1280),
            "960x720 (720p 4:3)": (960, 720),
        }
        if resolution != "Manual" and resolution in preset_map:
            width, height = preset_map[resolution]

        # 2. Resolve frame preset
        frame_map = {
            "81 frames (~5 sec @ 16fps)": 81,
            "49 frames (~3 sec @ 16fps)": 49,
            "33 frames (~2 sec @ 16fps)": 33,
            "17 frames (~1 sec @ 16fps)": 17,
        }
        if frames != "Manual" and frames in frame_map:
            length = frame_map[frames]

        # 3. Model Architecture Parameters
        if "Wan" in model_type:
            channels = 16
            spatial_scale = 8
            # Wan temporal compression: (T - 1) // 4 + 1
            latent_t = (length - 1) // 4 + 1
            is_5d = True
        elif "Hunyuan" in model_type:
            channels = 16
            spatial_scale = 8
            latent_t = (length - 1) // 4 + 1
            is_5d = True
        elif "LTX" in model_type:
            channels = 128
            spatial_scale = 32
            latent_t = (length - 1) // 8 + 1
            is_5d = True
        else:
            # Standard / SVD / 2D sequence
            channels = 4
            spatial_scale = 8
            latent_t = length
            is_5d = False

        latent_h = (height + spatial_scale - 1) // spatial_scale
        latent_w = (width + spatial_scale - 1) // spatial_scale

        # 4. Resolve VAE from input or pipe
        resolved_vae = vae
        if resolved_vae is None and pipe is not None and len(pipe) > 2:
            resolved_vae = pipe[2]

        # 5. Image-to-Video (I2V) vs Text-to-Video (T2V)
        use_i2v = (mode == "Image to Video (I2V)") and (image is not None)
        concat_latent_image = None
        concat_mask = None

        if use_i2v:
            # 1. Resize image to target (height, width)
            # image is [B, H, W, C]
            img_tensor = image
            if img_tensor.shape[1] != height or img_tensor.shape[2] != width:
                permuted = img_tensor.permute(0, 3, 1, 2)
                resized = F.interpolate(permuted, size=(height, width), mode="bilinear", align_corners=False)
                img_tensor = resized.permute(0, 2, 3, 1)

            # 2. Wan 2.1 & HunyuanVideo use conditioning concat_latent_image with temporal padding
            if ("Wan" in model_type or "Hunyuan" in model_type) and resolved_vae is not None:
                try:
                    # Pad sequence to `length` frames with 0.5 gray background
                    seq = torch.ones((length, height, width, 3), device=img_tensor.device, dtype=img_tensor.dtype) * 0.5
                    num_start = min(img_tensor.shape[0], length)
                    seq[:num_start] = img_tensor[:num_start, :, :, :3]

                    # Encode full sequence through Wan 3D causal VAE
                    concat_latent_image = resolved_vae.encode(seq[:, :, :, :3])

                    # Build temporal mask: 0.0 for starting frames (fixed), 1.0 for remainder (generated)
                    mask_t = latent_t
                    mask = torch.ones((1, 1, mask_t, concat_latent_image.shape[-2], concat_latent_image.shape[-1]), device=img_tensor.device, dtype=img_tensor.dtype)
                    mask[:, :, :((num_start - 1) // 4) + 1] = 0.0
                    concat_mask = mask
                except Exception as e:
                    print(f"[ModusFlow VideoLatent] Wan VAE sequence encode warning: {e}")

            # 3. Clean spatio-temporal noise latent
            if is_5d:
                samples = torch.zeros((batch_size, channels, latent_t, latent_h, latent_w))
                # For non-Wan models that inject directly into latent (e.g. SVD/LTX)
                if concat_latent_image is None and resolved_vae is not None:
                    try:
                        encoded = resolved_vae.encode(img_tensor[:1, :, :, :3])
                        if encoded.dim() == 4:
                            samples[:, :, :1, :, :] = encoded[:, :, None, :latent_h, :latent_w]
                        elif encoded.dim() == 5:
                            samples[:, :, :1, :, :] = encoded[:, :, :1, :latent_h, :latent_w]
                    except Exception as e:
                        print(f"[ModusFlow VideoLatent] Fallback encode warning: {e}")
            else:
                samples = torch.zeros((length * batch_size, channels, latent_h, latent_w))
                if resolved_vae is not None:
                    try:
                        encoded = resolved_vae.encode(img_tensor[:1, :, :, :3])
                        samples[:batch_size, :, :, :] = encoded[:batch_size, :, :latent_h, :latent_w]
                    except Exception as e:
                        print(f"[ModusFlow VideoLatent] 4D encode warning: {e}")
        else:
            # Clean T2V empty latent
            if is_5d:
                samples = torch.zeros((batch_size, channels, latent_t, latent_h, latent_w))
            else:
                samples = torch.zeros((length * batch_size, channels, latent_h, latent_w))

        out_latent = {
            "samples": samples,
            "width": width,
            "height": height,
            "length": length,
        }
        if concat_latent_image is not None:
            out_latent["concat_latent_image"] = concat_latent_image
            out_latent["concat_mask"] = concat_mask

        # If pipe is provided, also inject concat conditioning into pipe
        if pipe is not None and len(pipe) >= 5 and concat_latent_image is not None:
            try:
                import node_helpers
                new_pos = node_helpers.conditioning_set_values(pipe[3], {"concat_latent_image": concat_latent_image, "concat_mask": concat_mask})
                new_neg = node_helpers.conditioning_set_values(pipe[4], {"concat_latent_image": concat_latent_image, "concat_mask": concat_mask})
            except Exception:
                new_pos, new_neg = [], []
                vals = {"concat_latent_image": concat_latent_image, "concat_mask": concat_mask}
                for t, d in (pipe[3] or []):
                    nd = d.copy()
                    nd.update(vals)
                    new_pos.append([t, nd])
                for t, d in (pipe[4] or []):
                    nd = d.copy()
                    nd.update(vals)
                    new_neg.append([t, nd])
            pipe = (pipe[0], pipe[1], pipe[2], new_pos, new_neg) + tuple(pipe[5:])

        return (out_latent, pipe, width, height, length,)


NODE_CLASS_MAPPINGS = {
    "ModusFlowVideoLatent": ModusFlowVideoLatent
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "ModusFlowVideoLatent": "ModusFlow Video Latent Preset"
}
