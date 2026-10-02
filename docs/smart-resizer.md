# Smart Resizer & Aspect Ratio Optimizer

Aspect ratio optimization and smart cropping/padding for diffusion models.

## Overview

The **ModusFlow Smart Resizer** (`ModusFlowSmartResizer`) prepares arbitrary images for generation, Img2Img, ControlNet, and VAE encoding. It resizes to standard aspect ratios while strictly enforcing multiples of 16 or 64 to avoid VAE dimension errors and seam artifacts in ChromaHD, Flux, and SDXL.

## Supported Aspect Ratios

- `1:1 Square (1024x1024)`
- `16:9 Landscape (1344x768)`
- `9:16 Portrait / Story (768x1344)`
- `4:5 Social Portrait (896x1152)`
- `3:4 Classic Portrait (864x1152)`
- `4:3 Classic Landscape (1152x864)`
- `21:9 Cinema UltraWide (1536x640)`
- `Original Aspect Ratio`: Automatically preserves source ratio scaled to model base resolution.
- `Custom Resolution`: Specify custom width and height.

## Fit Modes

- **Center Crop**: Scales to cover and crops equally from all sides.
- **Top / Focus Crop**: Anchors the crop to the upper third (ideal for portraits to prevent cutting off heads).
- **Bottom Crop**: Anchors the crop to the bottom.
- **Pad (Black)**: Preserves full image without cropping, adding black letterboxing.
- **Pad (Edge Replicate)**: Adds blurred ambient background matching the image edges.
- **Stretch**: Direct resize without cropping or padding.

## Inputs

- **image** (IMAGE): Source image or batch.
- **aspect_ratio** (COMBO): Target ratio preset.
- **fit_mode** (COMBO): Cropping or padding strategy.
- **target_base** (COMBO): Resolution tier (`1024`, `768`, or `512`).
- **multiple_of** (COMBO): `16` (standard) or `64` (strict VAE compatibility).
- **custom_width** / **custom_height** (INT, optional): Used when `Custom Resolution` is selected.

## Outputs

| Output | Type | Description |
|---|---|---|
| `image` | IMAGE | Formatted, scaled image |
| `width` | INT | Computed pixel width |
| `height` | INT | Computed pixel height |
| `aspect_ratio_str` | STRING | Label (e.g. `16:9` or `1:1`) |
