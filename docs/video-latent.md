# ModusFlow Video Latent Preset

Create a spatio-temporal 5D latent tensor for video diffusion models (Wan 2.1, HunyuanVideo, LTX-Video, Cosmos), supporting both **Text-to-Video (T2V)** and **Image-to-Video (I2V)** workflows in a single node.

## Overview
- **Unified T2V & I2V**: Seamlessly switch between Text-to-Video and Image-to-Video modes using a simple dropdown without needing to rebuild or rewire the graph.
- **Model Architecture Presets**: Preconfigured latent channel counts and temporal downscaling factors for major video backbones:
  - `Wan 2.1 (16ch, 4x time)`: 16 latent channels, 4x temporal compression formula `(frames - 1) // 4 + 1`.
  - `HunyuanVideo (16ch, 4x time)`: 16 latent channels, 4x temporal compression.
  - `LTX-Video (128ch, 8x time)`: 128 channels, 8x temporal compression.
  - `Standard (4ch, 1x time)`: 4 channels, 1x temporal compression.
  - `Manual`: Custom channel count and downscaling factor.
- **Resolution & Frame Presets**: Standard 16:9, 9:16, 4:3, and 1:1 video resolutions up to 720p, alongside standard video frame counts (81, 49, 33, 17 frames).

## Inputs

### Required
- **mode** (dropdown):
  - `Text to Video (T2V)`: Generates an empty/zero spatio-temporal 5D latent tensor shaped `[batch, channels, latent_frames, height//8, width//8]`.
  - `Image to Video (I2V)`: Takes the input `image`, resizes/crops it to the target resolution, encodes frame 0 using the provided `vae`, and anchors the first frame in the video latent space for guided video synthesis.
- **architecture** (dropdown):
  - `Wan 2.1 (16ch, 4x time)` (Default)
  - `HunyuanVideo (16ch, 4x time)`
  - `LTX-Video (128ch, 8x time)`
  - `Standard (4ch, 1x time)`
  - `Manual`
- **resolution** (dropdown):
  - `832x480 (16:9 Landscape)` (Default for Wan 2.1 1.3B)
  - `480x832 (9:16 Portrait)`
  - `640x480 (4:3 Standard)`
  - `480x640 (3:4 Standard)`
  - `512x512 (1:1 Square)`
  - `1280x720 (720p 16:9)`
  - `720x1280 (720p 9:16)`
  - `Manual`
- **frames** (dropdown):
  - `81 frames (5s @ 16fps / 3.4s @ 24fps)` (Default)
  - `49 frames (3s @ 16fps / 2s @ 24fps)`
  - `33 frames (2s @ 16fps / 1.4s @ 24fps)`
  - `17 frames (1s @ 16fps / 0.7s @ 24fps)`
  - `Manual`
- **batch_size** (INT, default: 1): Number of parallel video latents to generate.

### Optional
- **image** (IMAGE): Reference image for Image-to-Video generation. Required when `mode` is `Image to Video (I2V)`.
- **vae** (VAE): VAE used to encode the reference image into the latent space for I2V.
- **width** (INT, default: 832): Used when `resolution` is set to `Manual`.
- **height** (INT, default: 480): Used when `resolution` is set to `Manual`.
- **frame_count** (INT, default: 81): Used when `frames` is set to `Manual`.
- **latent_channels** (INT, default: 16): Used when `architecture` is set to `Manual`.
- **temporal_downscale** (INT, default: 4): Used when `architecture` is set to `Manual`.

## Outputs
- **LATENT**: Spatio-temporal 5D latent tensor `{"samples": tensor, "width": W, "height": H, "frames": F}` compatible with ComfyUI video samplers and VAE decoders.

## How I2V vs T2V Switching Works
In standard ComfyUI video setups, converting an Image-to-Video graph into a Text-to-Video graph usually requires unlinking the VAE Encode node, adding an EmptyLatent node, and rewiring the KSampler.

With **ModusFlow Video Latent Preset**, the `image` and `vae` inputs are connected directly to this node. To switch:
- Simply change **mode** from `Image to Video (I2V)` to `Text to Video (T2V)`.
- When set to `Text to Video (T2V)`, the node automatically bypasses image encoding and creates a pure empty 5D video latent, without needing to delete or unlink the image loader.
