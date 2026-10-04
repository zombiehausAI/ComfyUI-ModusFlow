"""
ModusFlow De-Wax Texture Restore Node

Post-decode micro-texture reconstruction node that recovers authentic skin pore
structure, micro-relief, and natural sensor grain without relying on LoRAs.
Works natively on GPU PyTorch tensors with ITU-R BT.709 mid-tone grain weighting.
"""

import torch
import torch.nn.functional as F


class ModusDeWaxTextureRestore:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "image": ("IMAGE",),
                "micro_texture": ("FLOAT", {"default": 0.30, "min": 0.0, "max": 2.0, "step": 0.05, "round": 0.001}),
                "grain_intensity": ("FLOAT", {"default": 0.12, "min": 0.0, "max": 1.0, "step": 0.01, "round": 0.001}),
                "blur_radius": ("INT", {"default": 3, "min": 1, "max": 9, "step": 2}),
            },
            "optional": {
                "blend_mode": (["normal", "soft_light", "overlay", "linear_light", "screen", "multiply"], {"default": "normal"}),
                "blend_strength": ("FLOAT", {"default": 1.0, "min": 0.0, "max": 1.0, "step": 0.05, "round": 0.01}),
                "mask": ("MASK",),
                "pipe": ("PIPE",),
            }
        }

    RETURN_TYPES = ("IMAGE", "PIPE")
    RETURN_NAMES = ("image", "pipe")
    FUNCTION = "restore_texture"
    CATEGORY = "ModusFlow/PostProcessing"

    def restore_texture(self, image, micro_texture, grain_intensity, blur_radius,
                        blend_mode="normal", blend_strength=1.0, mask=None, pipe=None):
        # Permute input from [B, H, W, C] to [B, C, H, W] for 2D convolution
        x = image.permute(0, 3, 1, 2).contiguous()
        b, c, h, w = x.shape

        # Frequency separation filter size
        k = blur_radius if blur_radius % 2 == 1 else blur_radius + 1
        if k > 1:
            pad = k // 2
            sigma = max(0.5, float(k) / 3.0)
            coords = torch.arange(k, device=x.device, dtype=x.dtype) - (k - 1) / 2.0
            kernel_1d = torch.exp(-0.5 * (coords / sigma) ** 2)
            kernel_1d = kernel_1d / kernel_1d.sum()

            # Separable 2D Gaussian blur with reflect padding to avoid border artifacts
            kernel_h = kernel_1d.view(1, 1, 1, k).repeat(c, 1, 1, 1)
            x_padded_h = F.pad(x, (pad, pad, 0, 0), mode="reflect")
            low_freq = F.conv2d(x_padded_h, kernel_h, groups=c)

            kernel_v = kernel_1d.view(1, 1, k, 1).repeat(c, 1, 1, 1)
            low_padded_v = F.pad(low_freq, (0, 0, pad, pad), mode="reflect")
            low_freq = F.conv2d(low_padded_v, kernel_v, groups=c)
        else:
            low_freq = x

        high_freq = x - low_freq

        # High-frequency micro-texture boost
        boosted = x + (high_freq * micro_texture)

        # Calculate ITU-R BT.709 relative luminance
        # Channel 0: Red, Channel 1: Green, Channel 2: Blue
        r = boosted[:, 0:1, :, :]
        g = boosted[:, 1:2, :, :]
        b_chan = boosted[:, 2:3, :, :]
        luma = 0.2126 * r + 0.7152 * g + 0.0722 * b_chan
        luma = torch.clamp(luma, 0.0, 1.0)

        # Mid-tone weighting curve: 4.0 * luma * (1.0 - luma)
        # Concentrates grain in skin mid-tones; falls off in blown highlights and dark blacks
        midtone_weight = 4.0 * luma * (1.0 - luma)
        midtone_weight = torch.clamp(midtone_weight, 0.0, 1.0)

        # Inject mid-tone weighted procedural grain
        noise = torch.randn_like(x)
        out = boosted + (noise * 0.5 * grain_intensity * midtone_weight)

        # Apply blend mode against base image x
        if blend_mode == "soft_light":
            a = x
            b_val = torch.clamp(out, 0.0, 1.0)
            low_mask = (b_val <= 0.5).float()
            res_low = 2.0 * a * b_val + (a ** 2) * (1.0 - 2.0 * b_val)
            res_high = 2.0 * a * (1.0 - b_val) + torch.sqrt(torch.clamp(a, min=1e-7)) * (2.0 * b_val - 1.0)
            mode_result = low_mask * res_low + (1.0 - low_mask) * res_high
            blended = torch.lerp(x, mode_result, blend_strength)
        elif blend_mode == "overlay":
            a = x
            b_val = torch.clamp(out, 0.0, 1.0)
            low_mask = (a <= 0.5).float()
            res_low = 2.0 * a * b_val
            res_high = 1.0 - 2.0 * (1.0 - a) * (1.0 - b_val)
            mode_result = low_mask * res_low + (1.0 - low_mask) * res_high
            blended = torch.lerp(x, mode_result, blend_strength)
        elif blend_mode == "linear_light":
            a = x
            b_val = torch.clamp(out, 0.0, 1.0)
            mode_result = torch.clamp(2.0 * b_val + a - 1.0, 0.0, 1.0)
            blended = torch.lerp(x, mode_result, blend_strength)
        elif blend_mode == "screen":
            a = x
            b_val = torch.clamp(out, 0.0, 1.0)
            mode_result = 1.0 - (1.0 - a) * (1.0 - b_val)
            blended = torch.lerp(x, mode_result, blend_strength)
        elif blend_mode == "multiply":
            a = x
            b_val = torch.clamp(out, 0.0, 1.0)
            mode_result = a * b_val
            blended = torch.lerp(x, mode_result, blend_strength)
        else:
            blended = torch.lerp(x, out, blend_strength)

        # Apply optional mask blending
        if mask is not None:
            m = mask.to(device=x.device, dtype=x.dtype)
            if m.ndim == 2:
                m = m.unsqueeze(0).unsqueeze(0)
            elif m.ndim == 3:
                m = m.unsqueeze(1)

            if m.shape[0] == 1 and b > 1:
                m = m.expand(b, -1, -1, -1)

            if m.shape[-2:] != (h, w):
                m = F.interpolate(m, size=(h, w), mode="bilinear", align_corners=False)

            m = torch.clamp(m, 0.0, 1.0)
            final_out = torch.lerp(x, blended, m)
        else:
            final_out = blended

        # Strict clamping to [0.0, 1.0] and permute back to [B, H, W, C]
        final_out = torch.clamp(final_out, 0.0, 1.0)
        final_out = final_out.permute(0, 2, 3, 1).contiguous()
        return (final_out, pipe)


NODE_CLASS_MAPPINGS = {
    "ModusDeWaxTextureRestore": ModusDeWaxTextureRestore
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "ModusDeWaxTextureRestore": "Modus De-Wax Texture Restore"
}
