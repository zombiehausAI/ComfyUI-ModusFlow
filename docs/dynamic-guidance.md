# Modus Dynamic Guidance

Sampling-level dynamic guidance hook to address plastic, waxy skin tones and over-saturation without requiring LoRAs.

## Overview

The **Modus Dynamic Guidance** node intercepts diffusion model sampling via ComfyUI's model unet wrapper. It dynamically decays the guidance scale over sampling steps—allowing high initial guidance for strong structural composition while progressively decreasing guidance during later refinement steps to preserve realistic skin micro-relief, natural pore textures, and soft color transitions.

It natively supports both normalized float timesteps (`1.0` -> `0.0` for flow / rectified models like Flux and ChromaHD-1) and integer scales (e.g. `999` -> `0` for SD 1.5, SDXL, and SD3).

## Features

- **Dynamic Guidance Scaling**: Seamlessly transitions from `scale_start` down to `scale_end` over the generation process.
- **Custom Decay Profiles**: Supports `linear`, `cosine`, and `exponential` decay schedules with adjustable `decay_power`.
- **Cross-Model Compatibility**: Automatically handles Flux-style conditioning (`"guidance"` tensor) as well as SD / SDXL / SD3 architectures without key errors.
- **Chain-Safe Wrapper**: Preserves and chains with other active unet wrappers or sampling hooks.
- **No LoRA Required**: Eliminates plastic and waxy skin artifacts directly at the sampling level.

## Inputs

### Required

| Input | Type | Default | Min | Max | Step | Description |
|-------|------|---------|-----|-----|------|-------------|
| scale_start | FLOAT | 3.5 | 0.5 | 15.0 | 0.1 | Initial guidance scale during early composition steps |
| scale_end | FLOAT | 1.8 | 0.5 | 10.0 | 0.1 | Final guidance scale during late detail refinement steps |
| decay_power | FLOAT | 1.0 | 0.1 | 4.0 | 0.1 | Power exponent controlling curve curvature (`1.0` = standard profile) |
| decay_profile | COMBO | linear | — | — | — | Schedule profile: `linear`, `cosine`, or `exponential` |

### Optional

| Input | Type | Description |
|-------|------|-------------|
| pipe | PIPE | ModusFlow pipe tuple `(model, clip, vae, positive, negative)` |
| model | MODEL | Individual diffusion model input (overrides model from pipe if both provided) |

## Outputs

| Output | Type | Description |
|--------|------|-------------|
| model | MODEL | Patched model with the dynamic guidance unet wrapper attached |
| pipe | PIPE | Passthrough ModusFlow pipe containing the patched model |

## Decay Profiles

- **linear**: Uniform linear transition between `scale_start` and `scale_end`.
- **cosine**: Smooth S-curve easing that maintains higher guidance across early-to-mid steps before gently decaying into the final scale.
- **exponential**: Faster initial drop-off or sharper curve governed by `decay_power`.

## Typical Workflow

### Standalone Wiring
```
Model Loader ──▶ Modus Dynamic Guidance ──▶ KSampler / Flux Sampler ──▶ VAE Decode
```

### ModusFlow Pipe Flow
```
Model Loader ──▶ LoRA Loader ──▶ pipe ──▶ Modus Dynamic Guidance ──▶ pipe ──▶ ModusFlow KSampler
```

## Tips

- **Flux & Rectified Flow**: Set `scale_start` to `3.5` and `scale_end` to `1.8` for natural skin tones and reduced synthetic glossiness.
- **SDXL Photorealism**: Try `scale_start = 6.0` and `scale_end = 3.0` with `cosine` decay to avoid burned highlights and over-smoothed facial features.
- **Adjusting Curve Speed**: Increase `decay_power` (> 1.0) to drop guidance earlier in the sampling schedule.

## Troubleshooting

- **No visible change**: Ensure you are passing the patched `model` output into your KSampler rather than the original unpatched model.
- **Guidance too soft**: Increase `scale_end` towards `scale_start` or set `decay_power` lower.
