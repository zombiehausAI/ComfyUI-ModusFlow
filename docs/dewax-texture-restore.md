# Modus De-Wax Texture Restore

Post-decode micro-texture reconstruction and organic sensor grain restoration node to eliminate plastic, waxy skin tones without LoRAs.

## Overview

The **Modus De-Wax Texture Restore** node operates in post-processing directly on decoded RGB image tensors (`[B, H, W, C]`). By combining PyTorch-accelerated frequency separation with ITU-R BT.709 relative luminance analysis, it separates broad skin tone gradients from fine micro-relief, boosts realistic epidermal pore structure, and synthesizes subtle procedural sensor grain specifically weighted towards skin mid-tones.

The entire processing pipeline runs natively on GPU tensors without converting to NumPy or PIL, ensuring high speed and zero memory transfer overhead.

---

## Features

- **GPU Frequency Separation**: Uses a separable 2D Gaussian blur kernel with reflection padding to extract fine surface detail (`high_freq = image - low_freq`).
- **Selective Pore & Texture Boost**: Amplifies genuine skin micro-relief (`micro_texture`) without exaggerating blemishes or creating harsh contour edges.
- **Mid-Tone Weighted Grain**: Applies procedural sensor grain using the luminance curve $4.0 \times \text{luma} \times (1.0 - \text{luma})$. Grain concentrates naturally on skin mid-tones while gracefully tapering off in specular highlights and deep shadow blacks.
- **Native ModusFlow Pipe Support**: Accepts and passes through ModusFlow's 5-tuple `PIPE` stream `(model, clip, vae, positive, negative)` so it can sit inline between KSampler and downstream detailers or upscalers.
- **Masking Support**: Accepts optional 2D or 3D masks (`[H, W]` or `[B, H, W]`) with automatic bilinear scaling and linear interpolation (`torch.lerp`) to constrain restoration strictly to skin or face regions.
- **Strict Clamping**: Guarantees output tensors remain clamped strictly between `0.0` and `1.0`.

---

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

---

## Outputs

| Output | Type | Description |
|--------|------|-------------|
| image | IMAGE | Restored image tensor with recovered micro-texture and natural grain |
| pipe | PIPE | Passthrough ModusFlow pipe forwarded directly to downstream nodes |

---

## Tuning Guide

Different portrait styles benefit from tailored balance between `micro_texture` and `grain_intensity`:

| Desired Look | `grain_intensity` | `micro_texture` | `blur_radius` | Best For |
|---|---|---|---|---|
| **Silky Smooth / Editorial** | **`0.00`** – **`0.04`** | **`0.15`** – **`0.20`** | `3` | Studio portraits, glamour, beauty shots where visible grain is unwanted |
| **Natural Photorealism** *(Recommended)* | **`0.05`** – **`0.08`** | **`0.25`** – **`0.30`** | `3` | Realistic everyday camera photos, organic skin with soft filmic texture |
| **High-Detail Macro Close-Up** | **`0.08`** – **`0.12`** | **`0.35`** – **`0.45`** | `3` | Close-up face crops, visible skin pores, authentic cinematic film look |

---

## Workflows

### ModusFlow Inline Pipe Flow
Place directly between **ModusFlow KSampler** and **ModusFlow All-in-One Detailer** or **Upscaler**:
```text
[ModusFlow KSampler] ──┬──► (image) ──► [Modus De-Wax Texture Restore] ──┬──► (image) ──► [All-in-One Detailer]
                       └──► (pipe)  ──►                                  └──► (pipe)  ──►
```

### Targeted Face/Skin Mask Workflow
Use a YOLO face/skin detection mask from an inpaint/detailer node to limit grain and pore restoration exclusively to facial areas:
```text
[ModusFlow KSampler] ──► (image) ──┬──► [Modus De-Wax Texture Restore] ──► [Save Image]
                                   │         ▲ (mask)
[YOLO / SAM Detector] ─────────────┴─────────┘
```

---

## Troubleshooting

- **Image feels too grainy or rough**:
  - Lower **`grain_intensity`** to `0.04` – `0.06` (or `0.0` for zero noise).
  - Check that **`micro_texture`** is between `0.15` and `0.25`.
- **Halo or ringing around high-contrast edges**:
  - Ensure **`blur_radius`** is set to `3` (higher values like `7` or `9` isolate larger contours rather than fine micro-pores).
- **Mask edges are visible**:
  - Feather or blur your input mask slightly before connecting it to `mask`.
