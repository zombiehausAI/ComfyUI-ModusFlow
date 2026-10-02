# ModusFlow Tools, ControlNet & Advanced Utilities

Overview and usage reference for ModusFlow's advanced utility suite: Tiled VAE Decoding, Pipe-Aware ControlNet, Latent Upscaling (2-Pass Hires Fix), Mask Tools, A/B Image Comparison, and Dynamic Wildcards.

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

## 4. Inpainting Mask Tools (`ModusFlowMaskTools`)
* **Category:** `ModusFlow/Image`
* **Overview:** Refines inpainting boundaries before encoding into latents.
* **Features:**
  * **Grow / Shrink (`grow_shrink`)**: Dilates or erodes mask edges (positive values expand mask; negative values contract).
  * **Feather / Blur (`blur_radius`)**: Smooths harsh mask seams with Gaussian feathering.
  * **Invert (`invert`)**: Flips masked and unmasked areas.
* **Outputs:** `mask` (MASK), `preview_image` (IMAGE).

---

## 5. A/B Image Comparison (`ModusFlowCompareImages`)
* **Category:** `ModusFlow/Image`
* **Overview:** Renders an interactive split-view comparison between Image A (Before) and Image B (After) with an adjustable divider line.
* **Usage:** Connect Image A (original generation) and Image B (after DeWax, Detailer, or Restormer) to visually inspect sharpness, texture restoration, and facial improvements side-by-side.
* **Inputs:** `image_a`, `image_b`, `split_percent` (0–100%), `split_direction` (Vertical / Horizontal), `show_divider` (BOOLEAN).
* **Outputs:** `comparison` (IMAGE), `image_a`, `image_b`.

---

## 6. Dynamic Prompts & Wildcards in `ModusFlowTextEditor`
* **Category:** `ModusFlow/Utilities`
* **Overview:** Dynamic syntax resolution is built directly into `ModusFlowTextEditor`.
* **Syntax:**
  * **Random Choice (`{a|b|c}`)**: E.g., `a {cyberpunk|steampunk|fantasy} heroine with {blue|silver|crimson} hair`.
  * **Nested Choices**: E.g., `{red {dress|robe}|blue armor}`.
  * **Wildcard Files (`__name__`)**: Automatically resolves `.txt` lists placed in `saved_prompts/wildcards/` or `wildcards/`.
