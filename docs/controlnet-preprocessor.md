# ControlNet Image Preprocessor

Lightweight, zero-dependency visual preprocessor for ControlNet guidance.

## Overview

The **ModusFlow Image Preprocessor** (`ModusFlowImagePreprocessor`) prepares reference images for ControlNet models without requiring heavy 3rd-party auxiliary installations or downloading gigabytes of preprocessor checkpoints.

## Preprocessors Supported

1. **Canny Edge**: Standard high-precision Canny edge detector for structure and line preservation.
2. **LineArt (Adaptive Threshold)**: Clean black-and-white ink lines and contours.
3. **Color / Palette Guidance**: Smooth color abstraction map for Recolor and Color ControlNets.
4. **Blur / Tile (Low-Res Guide)**: Downsampled and low-frequency representation for Tile and Upscale ControlNets.
5. **Luminance / Depth Proxy**: High-contrast luminance mapping providing a fast depth proxy.

## Inputs

- **image** (IMAGE): Input image or batch of images.
- **preprocessor** (COMBO): Select from the 5 supported algorithms.
- **low_threshold** (INT, default: 100): Minimum gradient threshold for edge detection.
- **high_threshold** (INT, default: 200): Maximum gradient threshold for edge detection.
- **blur_radius** (FLOAT, default: 4.0): Smoothing radius applied before edge/color extraction.
- **invert** (BOOLEAN, default: False): Inverts black and white values (e.g. white lines on black vs black on white).

## Outputs

| Output | Type | Description |
|---|---|---|
| `image` | IMAGE | Preprocessed hint image ready to wire into `ModusFlowControlNetApply` |

## Usage Pattern

```
[Load Image] ──► [ModusFlow Image Preprocessor] ──(image)──► [ModusFlow ControlNet Apply]
```
