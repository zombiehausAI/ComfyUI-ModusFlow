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
  - `Auto (I2V if image connected)`: Automatically encodes the image if connected; otherwise creates empty latent.
  - `Image to Video (I2V)`: Encodes starting image into the video latent timeline.
  - `Text to Video (T2V)`: Generates an empty spatio-temporal video latent.
  - `Text to Video (T2V - ignore image)`: Generates an empty latent even if an image is connected.
- **model_type** (dropdown):
  - `Wan 2.1 (16ch, 4x time)` (Default)
  - `Wan 2.2 (48ch, 4x time)`
  - `HunyuanVideo (16ch, 4x time)`
  - `LTX-Video (128ch, 8x time)`
  - `Standard / SVD (4ch, 1x time)`
- **resolution** (dropdown): Standard 16:9, 9:16, 4:3 presets (e.g. `832x480`, `480x832`, `1280x720`, or `Manual`).
- **width** (INT, default: 832): Latent width in pixels (used when `resolution` is `Manual` or as default).
- **height** (INT, default: 480): Latent height in pixels (used when `resolution` is `Manual` or as default).
- **frames** (dropdown): Preconfigured frame counts (`81 frames`, `49 frames`, `33 frames`, `17 frames`, or `Manual`).
- **length** (INT, default: 81): Total frame count (used when `frames` is `Manual` or as default).
- **batch_size** (INT, default: 1): Number of parallel video latents to generate.
- **fps** (FLOAT, default: 16.0): Video framerate (e.g. 16.0 for Wan 2.1/2.2, 24.0 or 25.0 for Hunyuan/LTX). Used to calculate exact video duration.

### Optional
- **image** (IMAGE): Reference image for Image-to-Video generation.
- **pipe** (PIPE): ModusFlow pipe containing model, CLIP, VAE, and conditioning.
- **vae** (VAE): VAE used to encode the reference image into latent space.

## Outputs
- **latent** (LATENT): Spatio-temporal 5D latent tensor `{"samples": tensor, "width": W, "height": H, "length": L, "fps": FPS, "duration": D}` compatible with ComfyUI video samplers and VAE decoders.
- **pipe** (PIPE): ModusFlow pipe with updated conditioning (e.g. I2V concat latents).
- **width** (INT): Resolved video pixel width.
- **height** (INT): Resolved video pixel height.
- **length** (INT): Resolved video frame count.
- **duration** (FLOAT): Exact duration in seconds calculated as `length / fps` (e.g. `81 frames / 16 fps = 5.062s`). Connect directly into audio synthesis nodes like MMAudio.
- **fps** (FLOAT): Video framerate (e.g. `16.0`), ready to connect to video combine or video preview nodes.

## Connecting to MMAudio (Video-to-Audio)
To synchronize MMAudio with your generated video:
1. On your **MMAudio Video-to-Audio Sampler** node, right-click and choose **Convert Widget to Input** -> **duration**.
2. Connect the **duration** output from **ModusFlow Video Latent Preset** directly into MMAudio's newly created **duration** input slot.
3. When you adjust the frame count (e.g., from 81 frames to 49 frames) or the FPS on the Video Latent node, the audio duration automatically adapts to match your video length without manual calculations.

## How I2V vs T2V Switching Works
In standard ComfyUI video setups, converting an Image-to-Video graph into a Text-to-Video graph usually requires unlinking the VAE Encode node, adding an EmptyLatent node, and rewiring the KSampler.

With **ModusFlow Video Latent Preset**, the `image` and `vae` inputs are connected directly to this node. To switch:
- Simply change **mode** between `Image to Video (I2V)` and `Text to Video (T2V)`.
- When set to `Text to Video (T2V - ignore image)` or `Text to Video (T2V)` without an image, the node automatically creates a pure empty 5D video latent without needing to delete or unlink the image loader.
