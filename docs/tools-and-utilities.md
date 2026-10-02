# ModusFlow Tools, ControlNet & Advanced Utilities

Overview and usage reference for ModusFlow's advanced utility suite: Tiled VAE Decoding, Pipe-Aware ControlNet, Latent Upscaling (2-Pass Hires Fix), Mask Tools, A/B Image Comparison, All-in-One Model Upscaling, Flow-Matching Timestep Shifting, and Dynamic Wildcards.

---

## 1. ModusFlow VAE Decode (`ModusFlowVAEDecode`)
* **Category:** `ModusFlow/Latent`
* **Overview:** Decodes latent tensors into pixel images with optional **Tiled VAE Decoding** and unified `PIPE` passthrough.
* **Why Tiled VAE?** Decoding large $2\text{K} - 8\text{K}$ images with 16-channel Flux/Chroma or SDXL VAEs can easily trigger GPU Out-Of-Memory (OOM) errors. Tiled VAE divides the latent grid into tiles (e.g. 512px) and decodes them sequentially, using minimal VRAM.
* **Inputs:**
  * `samples` (LATENT): Latent tensor.
  * `tile_vae` (BOOLEAN): Enable tiled decoding (default: `false`).
  * `tile_size` (INT): Tile size in pixels (default: `512`).
  * `vae` (VAE, optional) / `pipe` (PIPE, optional): VAE source.
* **Outputs:** `image` (IMAGE), `pipe` (PIPE).

---

## 2. Pipe-Aware ControlNet (`ModusFlowControlNetApply` & `ModusFlowControlNetLoader`)
* **Category:** `ModusFlow/Conditioning`
* **Overview:** Seamlessly applies ControlNet or T2I-Adapter guidance (Canny, Depth, OpenPose, Anyline) directly into the unified `PIPE` without unbundling wires.
* **Usage:**
  ```
  [ Model Loader ] ── PIPE ──► [ Apply ControlNet ] ── PIPE ──► [ KSampler ]
                                      ▲
                           [ ControlNet Loader ]
  ```
* **Inputs:**
  * `image` (IMAGE): ControlNet hint/guide image (e.g. edge map, depth map, pose).
  * `strength` (FLOAT, default `1.0`): ControlNet influence.
  * `start_percent` / `end_percent` (FLOAT, `0.0 – 1.0`): Step range where ControlNet is active.
  * `control_net` (CONTROL_NET, optional): Loaded ControlNet model.
  * `pipe` (PIPE, optional): ModusFlow pipe.
* **Outputs:** `positive` (CONDITIONING), `negative` (CONDITIONING), `pipe` (PIPE).

---

## 3. Latent Upscale for 2-Pass Hires Fix (`ModusFlowLatentUpscale`)
* **Category:** `ModusFlow/Latent`
* **Overview:** Scales latent tensors by multiplier factors ($1.25\times, 1.5\times, 2.0\times$) using bicubic, bislerp, or bilinear interpolation with spatial alignment for DiT / Flux architectures.
* **Hires Fix Workflow:**
  1. Base generation with KSampler at 1024x1024.
  2. Route `latent` into `ModusFlow Latent Upscale` (set `scale_by: 1.5`).
  3. Route upscaled latent into a secondary `ModusFlow KSampler` with low denoise (`0.30 – 0.38`).
* **Inputs:** `samples` (LATENT), `upscale_method` (`bicubic`, `bislerp`, `bilinear`, `nearest-exact`), `scale_by` (FLOAT), `pipe` (PIPE, optional).
* **Outputs:** `latent` (LATENT), `width` (INT), `height` (INT), `pipe` (PIPE).

---

## 4. All-in-One Model Upscaler (`ModusFlowModelUpscale`)
* **Category:** `ModusFlow/Image`
* **Overview:** Complete super-resolution pipeline in a single node. Combines model loading (e.g. `4x-UltraSharp.pth`, `4x_NMKD-Superscale-SP_178000_G.pth`), neural upscaling inference, and high-quality downscaling with **independent bypass switches** for each stage.
* **Why Use It?** Eliminates the need to wire separate `UpscaleModelLoader`, `ImageUpscaleWithModel`, and third-party image scaler nodes (`easy imageScaleDownBy`).
* **Super-Resolution Workflow (e.g. 4x Model to 2x Output):**
  1. Set `upscale_model_name: "4x-UltraSharp.pth"`.
  2. Set `upscale_enabled: True`.
  3. Set `downscale_enabled: True`, `scale_down_by: 0.5`, `rescale_method: "lanczos"`.
  4. The image is super-resolved 4x by the model and downscaled 0.5x, yielding an ultra-crisp 2x final image with zero blurriness.
* **Inputs:**
  * `image` (IMAGE): Input pixel image.
  * `upscale_model_name` (dropdown): Available upscale models in `models/upscale_models`.
  * `upscale_enabled` (BOOLEAN, default `true`): Toggle the neural model upscaling pass.
  * `downscale_enabled` (BOOLEAN, default `true`): Toggle the subsequent downscaling pass.
  * `scale_down_by` (FLOAT, default `0.5`): Rescale factor.
  * `rescale_method` (`lanczos`, `bicubic`, `bilinear`, `area`, `nearest-exact`).
  * `pipe` (PIPE, optional): Pass-through pipe.
* **Outputs:** `image` (IMAGE), `pipe` (PIPE).

---

## 5. Flow-Matching Timestep Shifting (`ModusFlowChromaShift`)
* **Category:** `ModusFlow/Sampling`
* **Overview:** Applies resolution-dependent Flow-Matching timestep shifting for **Chroma 1-HD** and **FLUX.1** architectures.
* **Why Is It Needed?** Chroma 1-HD operates in continuous flow matching. As image resolutions deviate from standard $1024\times1024$ (e.g. $832\times1216$ portrait or $1280\times960$ landscape), the noise schedule needs resolution-dependent shift:
  $$\text{shift} = \frac{\text{width} \times \text{height}}{1024^2}$$
  Without timestep shifting, non-square Chroma generations can suffer from slower convergence or diminished micro-details.
* **Features:**
  * **Auto (from Latent / Image):** Connect a latent or image from your workflow; the node automatically reads the exact width and height and scales the shift without typing numbers.
  * **Pipe-Aware:** Connects directly into the ModusFlow pipe between the Model Loader and Dynamic Guidance / KSampler.
* **Inputs:**
  * `max_shift` (FLOAT, default `1.15`), `base_shift` (FLOAT, default `0.5`).
  * `width` / `height` (INT, default `1024`).
  * `mode` (`Auto (from Latent / Image)`, `Manual Resolution`, `Fixed Shift`, `Bypass`).
  * `fixed_shift` (FLOAT, default `1.0`).
  * `pipe` (PIPE, optional), `model` (MODEL, optional), `latent` (LATENT, optional), `image` (IMAGE, optional).
* **Outputs:** `model` (MODEL), `pipe` (PIPE).

---

## 6. Architecture Auto-Detection in `ModusFlowLatentPreset`
* **Category:** `ModusFlow/Latent`
* **Overview:** Creates blank latent tensors with common aspect ratio presets while completely preventing channel dimension errors between architectures.
* **16-Channel vs. 4-Channel Safety:**
  * **Chroma 1-HD & FLUX:** Require **16 latent channels** (`ae.sft`).
  * **SDXL & Pony:** Require **4 latent channels**.
* **Architecture Options:**
  * `Auto (from Pipe/VAE)`: Inspects the connected VAE/Pipe and automatically assigns 16 channels if Flux/Chroma `ae.sft` is detected, or 4 channels for SDXL.
  * `Chroma / Flux (16ch)`: Forces 16 channels.
  * `SDXL / Pony (4ch)` / `SD 1.5 (4ch)`: Forces 4 channels.
  * `Manual`: Uses the numerical `latent_channels` widget.
* **Outputs:** `latent` (LATENT), `pipe` (PIPE).

---

## 7. Inpainting Mask Tools (`ModusFlowMaskTools`)
* **Category:** `ModusFlow/Image`
* **Overview:** Refines inpainting boundaries before encoding into latents.
* **Features:**
  * **Grow / Shrink (`grow_shrink`)**: Dilates or erodes mask edges (positive values expand mask; negative values contract).
  * **Feather / Blur (`blur_radius`)**: Smooths harsh mask seams with Gaussian feathering.
  * **Invert (`invert`)**: Flips masked and unmasked areas.
* **Outputs:** `mask` (MASK), `preview_image` (IMAGE).

---

## 8. A/B Image Comparison (`ModusFlowCompareImages`)
* **Category:** `ModusFlow/Image`
* **Overview:** Renders an interactive split-view comparison between Image A (Before) and Image B (After) with an adjustable divider line.
* **Usage:** Connect Image A (original generation) and Image B (after DeWax, Detailer, or Restormer) to visually inspect sharpness, texture restoration, and facial improvements side-by-side.
* **Inputs:** `image_a`, `image_b`, `split_percent` (0–100%), `split_direction` (Vertical / Horizontal), `show_divider` (BOOLEAN).
* **Outputs:** `comparison` (IMAGE), `image_a`, `image_b`.
