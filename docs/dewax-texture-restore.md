# Modus De-Wax Texture Restore

Post-decode micro-texture reconstruction and organic sensor grain restoration node to eliminate plastic, waxy skin.

## Overview

The **Modus De-Wax Texture Restore** node operates in post-processing directly on decoded RGB image tensors. By applying PyTorch-accelerated frequency separation and ITU-R BT.709 relative luminance analysis, it separates coarse skin tones from high-frequency micro-relief, boosts fine pore detail, and synthesizes subtle procedural sensor grain specifically weighted towards skin mid-tones.

It works entirely in PyTorch on the GPU without costly round-trips to CPU, NumPy, or PIL.

## Features

- **Frequency Separation**: Extracts high-frequency micro-relief from low-frequency color masses using a separable Gaussian blur kernel.
- **Pore & Micro-Texture Boost**: Enhances fine epidermal texture (`micro_texture`) without exaggerating blemishes or macro lines.
- **Mid-tone Luminance Weighting**: Uses the parabolic curve `4.0 * luma * (1.0 - luma)` so procedural grain concentrates realistically on skin mid-tones while falling off in deep shadows and specular highlights.
- **Masking Support**: Optional single-channel mask (`[B, H, W]` or `[H, W]`) with automatic bilinear alignment for targeted face or skin restoration.
- **Pure Tensor GPU Pipeline**: Zero CPU transfers, strict `[0.0, 1.0]` clamping, and high performance.

## Inputs

### Required

| Input | Type | Default | Min | Max | Step | Description |
|-------|------|---------|-----|-----|------|-------------|
| image | IMAGE | — | — | — | — | Decoded input image tensor `[B, H, W, C]` in range `[0.0, 1.0]` |
| micro_texture | FLOAT | 0.30 | 0.0 | 2.0 | 0.05 | High-frequency detail and pore boost multiplier |
| grain_intensity | FLOAT | 0.12 | 0.0 | 1.0 | 0.01 | Intensity of procedural mid-tone organic sensor grain |
| blur_radius | INT | 3 | 1 | 9 | 2 | Frequency separation filter size (odd values: 1, 3, 5, 7, 9) |

### Optional

| Input | Type | Default | Description |
|-------|------|---------|-------------|
| mask | MASK | None | Optional single-channel mask to restrict texture restoration to specific regions |
| pipe | PIPE | None | Optional ModusFlow pipe tuple `(model, clip, vae, positive, negative)` for passthrough |

## Outputs

| Output | Type | Description |
|--------|------|-------------|
| image | IMAGE | Restored image tensor with recovered micro-texture and natural grain |
| pipe | PIPE | Passthrough ModusFlow pipe forwarded directly to downstream nodes |

## Technical Details

1. **Separable Gaussian Filter**: Employs horizontal and vertical 1D convolutions with reflection padding to eliminate edge artifacts.
2. **ITU-R BT.709 Luminance**: Computes relative luminance via `0.2126*R + 0.7152*G + 0.0722*B`.
3. **Mid-Tone Easing**: Procedural grain scales according to `4.0 * luma * (1.0 - luma)`, preventing noisy specular highlights and muddy crushed blacks.
4. **Mask Interpolation**: When a mask is connected, linear interpolation (`torch.lerp`) blends between original and restored tensors.

## Typical Workflow

### Standalone Wiring
```
KSampler ──▶ image ──▶ Modus De-Wax Texture Restore ──▶ Save Image / Upscaler
                            ▲ (optional mask)
YOLO / SAM Face Mask ───────┘
```

### ModusFlow Pipe Flow
```
ModusFlow KSampler ──┬──► image ──► Modus De-Wax Texture Restore ──┬──► image ──► Save Image
                     └──► pipe  ──►                              └──► pipe  ──► All-in-One Detailer / Upscaler
```

## Tips

- **Subtle Organic Feel**: Default values (`micro_texture = 0.30`, `grain_intensity = 0.12`, `blur_radius = 3`) provide a realistic filmic texture for portrait renders.
- **Intense Macro Detail**: For close-up portraits, increase `micro_texture` to `0.45` - `0.60`.
- **Targeted Application**: Feed a face/skin segmentation mask from a detailer or detector node into `mask` to apply texture only to skin areas, keeping background or cloth untouched.

## Troubleshooting

- **Image appears too grainy**: Reduce `grain_intensity` to `0.05` - `0.08`.
- **High-contrast ringing**: Keep `blur_radius` at `3` (recommended) to target only fine micro-pores rather than broader facial contours.
