# ModusFlow Img2Img & Fidelity Controller

Native image loading, VAE encoding, and human-friendly fidelity control for image-to-image workflows across **Chroma 1-HD**, **Flux.1**, **SDXL**, **Pony**, **Illustrious**, and **SD 1.5**.

---

## Overview

Traditional ComfyUI img2img workflows force users to juggle inverted, non-linear `denoise` values ($0.0$ = no change, $1.0$ = total chaos) and manually handle model-specific VAE resolution multiples.

ModusFlow introduces two streamlined paradigms for img2img:
1. **All-in-One (`ModusFlow Img2Img VAE Encode`)**: Combines image upload/input, VAE encoding, automatic architecture alignment (16px vs 8px), and the intuitive Fidelity Slider (0–100%) in a single node with unified `PIPE` passthrough.
2. **Modular (`ModusFlow VAE Encode` + `ModusFlow Fidelity Controller` + `ModusFlow Load Image`)**: Decouples the image loader, VAE encoder, and fidelity controller for maximum graph flexibility.

---

## The Human-Friendly Fidelity Slider

Instead of confusing denoise fractions, the **Fidelity Slider** (0% – 100%) controls how closely the generated image remains true to the original:

| Position / Preset | Meaning | Chroma / Flux Denoise | SDXL / Pony Denoise | Output Behavior |
|---|---|---|---|---|
| **100% (Far Right)** | **Replica + LoRA / Style** | `0.20 – 0.25` | `0.25 – 0.30` | Locks exact contours, poses, facial identity, and composition. Applies AnyLoRA textures, line art coloring, or lighting shifts without altering shapes. |
| **75% (Right-Mid)** | **Faithful Restyle** | `0.35 – 0.40` | `0.40 – 0.48` | Keeps the subject, silhouette, and scene layout intact while adapting clothing, hair, and surface details to match prompts. |
| **50% (Center)** | **Balanced Reimagining** | `0.55 – 0.62` | `0.58 – 0.65` | Preserves overall color scheme, framing, and macro composition, but freely redesigns the subject and background. |
| **25% (Left-Mid)** | **Creative Divergence** | `0.72 – 0.78` | `0.75 – 0.82` | Original image serves as an abstract color and lighting seed; the model generates new subjects and layouts. |
| **10% (Far Left)** | **Barely Recognizable** | `0.88 – 0.95` | `0.88 – 0.95` | Complete creative divergence; only faint ghosts of base colors remain. |

---

## Multi-Model Architecture Support

Different diffusion architectures have strict VAE downscale and latent channel requirements:

### 1. Chroma 1-HD & Flux.1
* **VAE**: 16 latent channels (`ae.safetensors`).
* **Alignment**: Requires spatial pixel dimensions divisible by **16** ($8\times$ VAE downscale $\times 2\times 2$ DiT patch size).
* **Automatic Adjustment**: ModusFlow automatically aligns incoming images to a multiple of 16 (via crop, rescale, or reflection padding) to prevent DiT reshape crashes.
* **Guidance**: Chroma 1-HD uses real CFG decay (`ModusDynamicGuidance` set to `CFG Scale (Chroma / SDXL / SD1.5)` with `scale_start: 4.5`, `scale_end: 1.8–2.0`).

### 2. SDXL, Pony V6 & Illustrious
* **VAE**: 4 latent channels.
* **Alignment**: Requires spatial pixel dimensions divisible by **8** (multiples of 64 recommended).
* **Guidance**: Use `CFG Scale (Chroma / SDXL / SD1.5)` with start scale `6.0 – 7.0` and end scale `3.0 – 3.5`.

### 3. Stable Diffusion 1.5
* **VAE**: 4 latent channels.
* **Alignment**: Requires spatial pixel dimensions divisible by **8**.

---

## Intelligent Step Compensation

In standard KSamplers, effective steps equal $\text{steps} \times \text{denoise}$. At low denoise (e.g. $0.25$), a 20-step configuration executes only 5 diffusion passes, which can result in under-baked textures or digital noise.

When **`step_compensation: true`** is enabled:
* The node automatically scales base steps upward at high fidelity so Chroma and SDXL always receive sufficient diffusion passes (at least 12–15 effective steps) to converge cleanly.
* At high denoise, steps settle back to your configured `base_steps`.

---

## Node References

### `ModusFlow Img2Img VAE Encode` (All-in-One)
* **Inputs:**
  * `fidelity` (FLOAT, 0–100%): Master similarity slider.
  * `preset` (COMBO): Quick shortcuts for common fidelity thresholds.
  * `target_model` (COMBO): `Chroma 1-HD`, `Flux.1`, `SDXL / Pony / Illustrious`, `SD 1.5`, `Custom`.
  * `alignment` (COMBO): `Auto`, `Divisible by 16`, `Divisible by 8`, `None`.
  * `resize_mode` (COMBO): `Crop to Multiple`, `Rescale to Multiple`, `Pad to Multiple`.
  * `curve` (COMBO): `Smooth S-Curve`, `Linear`, `Preserve Structure (Exponential)`, `Creative Bias`.
  * `base_steps` (INT): Default 25.
  * `step_compensation` (BOOLEAN): Auto-calculate steps for clean convergence.
  * `image` (IMAGE, optional): Incoming image from an external loader.
  * `image_upload` (COMBO, optional): Integrated image picker / file uploader widget directly on the node face.
  * `vae` (VAE, optional) / `pipe` (PIPE, optional): VAE source.
  * `mask` (MASK, optional): Inpainting mask.
* **Outputs:**
  * `latent`: Encoded LATENT ready for `ModusFlowKSampler`.
  * `denoise`: Calculated FLOAT denoise.
  * `steps`: Compensated INT steps.
  * `image`: Dimension-aligned IMAGE.
  * `pipe`: Passthrough PIPE.
  * `summary`: Real-time text display of fidelity %, denoise, and effective steps.

---

### `ModusFlow Fidelity Controller` (Modular Slider)
* **Inputs:** `fidelity`, `preset`, `target_model`, `curve`, `base_steps`, `step_compensation`, `min_denoise`, `max_denoise`, `pipe`.
* **Outputs:** `denoise` (FLOAT), `steps` (INT), `fidelity_pct` (FLOAT), `summary` (STRING), `pipe` (PIPE).
* **Usage:** Connect `denoise` and `steps` into `ModusFlowKSampler`'s converted input slots, or read the textual summary via `ModusFlowShowText`.

---

### `ModusFlow VAE Encode` (Modular Encoder)
* **Inputs:** `alignment`, `resize_mode`, `image`, `image_upload`, `vae`, `pipe`, `mask`.
* **Outputs:** `latent` (LATENT), `image` (aligned IMAGE), `width` (INT), `height` (INT), `pipe` (PIPE).

---

### `ModusFlow Load Image`
* **Inputs:** `image` (upload widget supporting PNG, JPG, JPEG, WEBP, BMP, TIFF).
* **Outputs:** `image` (IMAGE), `mask` (MASK from alpha channel if present), `width` (INT), `height` (INT), `filename` (STRING).

---

## Troubleshooting & Tips

* **Static or Noise in Chroma 1-HD**: Verify `ModusDynamicGuidance` is set to `CFG Scale (Chroma / SDXL / SD1.5)` with `scale_start: 4.5` and `scale_end: 2.0`. Never use `Flux / SD3 (Distilled Guidance)` mode on Chroma.
* **Aspect Ratio Distortions**: Keep `resize_mode` on `Crop to Multiple`. This minimally center-crops $1 - 15$ boundary pixels to satisfy the 16px/8px grid without stretching or warping the subject.
* **Waxy Skin / Smoothing at Low Denoise**: Wire the sampler's `image` output into `ModusDeWaxTextureRestore` with `blend_mode: soft_light`, `blend_strength: 0.15`, and `detail_boost: 0.10`.
