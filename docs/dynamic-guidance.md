# Modus Dynamic Guidance

Sampling-level dynamic guidance hook to address plastic, waxy skin tones and over-saturation without requiring LoRAs.

## Overview

The **Modus Dynamic Guidance** node dynamically decays guidance strength over the course of diffusion sampling. High initial guidance establishes strong prompt fidelity, lighting, and composition during early steps, while progressively reducing guidance during later steps prevents the synthetic glossiness, waxy skin tones, and harsh contrast typical of constant guidance.

It natively supports both:
1. **True CFG Scale Decay** (via ComfyUI's `sampler_cfg_function`): For de-distilled and traditional diffusion models including **Chroma 1-HD**, **SDXL**, **Pony**, and **SD 1.5**.
2. **Distilled Guidance Decay** (via ComfyUI's `model_function_wrapper`): For rectified flow models with distilled guidance conditioning tensors including **Flux.1-dev** and **SD3**.

When removed or bypassed, the model reverts 100% to standard vanilla ComfyUI behavior with no residual state.

---

## Features

- **Dual Guidance Modes**: Supports both sampler CFG scaling and DiT internal distilled guidance conditioning.
- **Dynamic Guidance Scaling**: Seamlessly transitions from `scale_start` down to `scale_end` across sampling steps.
- **Custom Decay Curves**: Choose between `linear`, `cosine` (smooth S-curve), and `exponential` schedules with tunable `decay_power`.
- **ModusFlow Pipe Compatible**: Operates directly inline on ModusFlow 5-tuple `PIPE` streams `(model, clip, vae, positive, negative)` as well as standalone `MODEL` wires.
- **Chain-Safe Architecture**: Preserves and forwards existing model wrappers or sampler functions.
- **Anti-Burnout**: Eliminates guidance-induced skin burning and plastic textures directly in the sampling loop without LoRAs.

---

## Inputs

### Required

| Input | Type | Default | Min | Max | Step | Description |
|-------|------|---------|-----|-----|------|-------------|
| scale_start | FLOAT | 3.5 | 0.5 | 15.0 | 0.1 | Initial guidance scale during early composition steps |
| scale_end | FLOAT | 1.8 | 0.5 | 10.0 | 0.1 | Final guidance scale during late detail refinement steps |
| decay_power | FLOAT | 1.0 | 0.1 | 4.0 | 0.1 | Power exponent controlling curve curvature (`1.0` = standard profile) |
| decay_profile | COMBO | linear | — | — | — | Schedule profile: `linear`, `cosine`, or `exponential` |
| guidance_mode | COMBO | CFG Scale (Chroma / SDXL / SD1.5) | — | — | — | Target mechanism: `CFG Scale (Chroma / SDXL / SD1.5)` or `Flux / SD3 (Distilled Guidance)` |

### Optional

| Input | Type | Description |
|-------|------|-------------|
| pipe | PIPE | ModusFlow pipe tuple `(model, clip, vae, positive, negative)`. Takes model from `pipe[0]` |
| model | MODEL | Individual diffusion model input (overrides model from pipe if both provided) |

---

## Outputs

| Output | Type | Description |
|--------|------|-------------|
| model | MODEL | Patched model instance with the dynamic guidance hook attached |
| pipe | PIPE | Passthrough ModusFlow pipe tuple forwarding the patched model to downstream nodes |

---

## Guidance Modes Explained

### 1. `CFG Scale (Chroma / SDXL / SD1.5)` *(Default)*
- **How it works**: Hooks directly into ComfyUI's `sampler_cfg_function`. It dynamically calculates the classifier-free guidance difference at each step:
  $$\text{output} = \text{uncond} + (\text{cond} - \text{uncond}) \times \text{current\_scale}$$
- **When to use**: 
  - **Chroma 1-HD**: Chroma is a de-distilled Flux architecture trained to accept real CFG (3.5 – 4.5) and negative prompts. This mode scales KSampler's CFG multiplier directly **without touching the DiT guidance embedding**, avoiding the $15\times$ guidance blowup that causes static noise.
  - **SDXL, Pony, SD 1.5**: Standard diffusion models where guidance is governed by KSampler's CFG slider.

### 2. `Flux / SD3 (Distilled Guidance)`
- **How it works**: Hooks into ComfyUI's `model_function_wrapper` to update the internal `c["guidance"]` tensor passed into the DiT transformer.
- **When to use**: 
  - **Stock Flux.1-dev / SD3**: Models that utilize distilled guidance with KSampler's `cfg` widget kept strictly at `1.0`.

---

## Decay Profiles

- **linear**: A direct, uniform linear transition from `scale_start` to `scale_end`.
- **cosine**: Smooth S-curve easing that preserves strong guidance throughout the initial composition phase before gently tapering into the lower scale. Recommended for photorealistic skin tones.
- **exponential**: Sharper initial decay controlled by `decay_power`.

### Understanding `decay_power`
- **`1.0`** (Default): Standard profile curve.
- **`< 1.0`** (e.g., `0.7`): Guidance stays higher for longer before decaying toward `scale_end`.
- **`> 1.0`** (e.g., `1.5`): Guidance drops off rapidly in early steps, spending more time at `scale_end`.

---

## Recommended Settings by Model

| Model Family | `guidance_mode` | `scale_start` | `scale_end` | KSampler `cfg` | Profile |
|---|---|---|---|---|---|
| **Chroma 1-HD** | `CFG Scale (Chroma / SDXL / SD1.5)` | `4.5` | `1.8` – `2.0` | `4.5` | `cosine` |
| **Flux.1-dev** | `Flux / SD3 (Distilled Guidance)` | `3.5` | `1.8` | `1.0` *(must be 1.0)* | `cosine` |
| **SDXL / Pony** | `CFG Scale (Chroma / SDXL / SD1.5)` | `6.5` | `3.0` – `3.5` | `6.5` – `7.0` | `linear` |
| **SD 1.5** | `CFG Scale (Chroma / SDXL / SD1.5)` | `7.0` | `3.5` | `7.0` | `linear` |

---

## Workflows

### ModusFlow Pipe Workflow
```text
[Model Loader] ──► [LoRA Loader] ──► (pipe) ──► [Modus Dynamic Guidance] ──► (pipe) ──► [ModusFlow KSampler]
```

### Standalone Model Workflow
```text
[Checkpoint / UNet Loader] ──► (model) ──► [Modus Dynamic Guidance] ──► (model) ──► [KSampler]
```

---

## Troubleshooting

- **Image is pure visual noise / static**:
  - *Chroma 1-HD*: Ensure `guidance_mode` is set to `CFG Scale (Chroma / SDXL / SD1.5)`. If set to `Flux / SD3` while KSampler has `cfg: 4.5`, the model receives dual-multiplied guidance ($\approx 16\times$) which blows out latents into noise.
  - *Flux.1-dev*: Ensure KSampler `cfg` is set to `1.0`.
  - *Widget NaN*: Verify `decay_power` is set to `1.0` (not `NaN`).
- **Skin still looks slightly waxy**: Lower `scale_end` (e.g., from `2.0` down to `1.5`).
- **Prompt adherence is too loose**: Raise `scale_end` closer to `scale_start` or decrease `decay_power` to `0.8`.
