# ModusFlow Workflow & Node Usage Guide

This guide explains how to connect and use ModusFlow custom nodes in ComfyUI, from basic generation to advanced multi-pass detailing and upscaling.

---

## 1. Core Architecture: The ModusFlow Pipe

ModusFlow uses a unified **`PIPE`** bus that carries the complete generation state:
```
PIPE = (model, clip, vae, positive, negative)
```
Using the pipe significantly simplifies node graphs by eliminating bundles of wires running across the canvas. Individual inputs (e.g. hooking up a separate `positive` or `model`) always override what is inside the pipe.

```
[ Model Loader ] ── PIPE ──► [ LoRA Loader ] ── PIPE ──► [ KSampler ] ── PIPE ──► [ All-in-One Detailer ]
                                                              │
                                                            IMAGE
                                                              ▼
                                                   [ Upscaler / Restormer ]
```

---

## 2. Step-by-Step Workflows

### Workflow A: Clean Base Generation (Pipe-Driven)

1. **Add `ModusFlow Model Loader`**:
   - Select your checkpoint or UNet + CLIPs + VAE.
   - Outputs: `pipe`, `model`, `clip_merged`, `vae`.
2. **Add `ModusFlow LoRA Loader`** *(optional)*:
   - Connect `pipe` from the Model Loader to `pipe` on the LoRA Loader.
   - Add your desired LoRAs directly in the node UI. Adjust strengths and toggle them on/off as needed.
3. **Add Conditioning**:
   - Connect `clip` from the Model Loader (or LoRA Loader) to **`ModusFlow Text Editor`** or standard `CLIPTextEncode`.
   - Connect positive and negative conditionings into the LoRA Loader or KSampler inputs.
4. **Add `ModusFlow Latent Preset`**:
   - Choose a resolution preset (e.g. `1024x1024 (Square)`, `832x1216 (Portrait)`).
   - Connect `latent` into KSampler's `latent_image`.
5. **Add `ModusFlow KSampler`**:
   - Connect `pipe` into KSampler.
   - Set steps, CFG, sampler name, and scheduler.
   - Connect the output `image` to a preview or save node.

---

### Workflow B: AI Prompt Refinement with Ollama

Enhance simple ideas into detailed generation prompts using a local LLM before generation:

1. **Add `ModusFlow Ollama Prompt Refiner`**:
   - Enter your base prompt in `prompt` (e.g. `"cyberpunk street market at dusk"`).
   - Select an Ollama model (e.g. `llama3`, `mistral`, `llava`).
   - Choose an enhancement mode: `refine`, `generate`, `describe`, or `custom`.
2. **Wire to Conditioning**:
   - Connect `clip` from your Model Loader to the Prompt Refiner.
   - Connect the resulting `positive` output directly into KSampler.
3. **Inspect Output**:
   - Connect `refined_text` to **`ModusFlow ShowText`** to read the generated prompt text directly on the canvas.

---

### Workflow C: Multi-Pass Detailing (Faces, Hands, Eyes)

The **All-in-One Detailer** runs sequential YOLO detection and inpainting passes on detected regions:

1. **Configure Passes with `ModusFlow Detailer Slot`**:
   - Add a `Detailer Slot` for each feature you want to enhance (e.g. one for face, one for hands).
   - Select the YOLO detector model (e.g. `face_yolov8n.pt`, `hand_yolov8s.pt`).
   - Adjust `denoise` (typically `0.25` - `0.35` for subtle refinement, higher for reconstruction).
   - Configure `mask_blur`, `blend_feather`, and `steps`.
2. **Connect to `ModusFlow All-in-One Detailer`**:
   - Connect KSampler's output `image` to `image` on the detailer.
   - Connect KSampler's output `pipe` to `pipe` on the detailer.
   - Wire each configured `Detailer Slot` into `slot_1`, `slot_2`, etc.
3. **Execution**:
   - The detailer detects each region in sequence, crops with context padding, inpaints using your prompt and model, feathers the seams, and blends the result back into the main image.

---

### Workflow D: High-Resolution Tiled Upscaling & Restoration

1. **Add `ModusFlow Upscaler`**:
   - Connect the detailed image from the Detailer or KSampler.
   - Select an upscale model (e.g. UltraMix, NMKD, DAT) or choose bicubic/lanczos scaling.
   - If using tiled KSampler refinement, configure tile size, tile overlap, and seam blending.
2. **Add `ModusFlow Restormer`** *(optional finishing touch)*:
   - For removing blur or camera artifacts, route the upscaled image through Restormer.
   - Select task: `Motion_Deblurring`, `Single_Image_Defocus_Deblurring`, or `Gaussian_Color_Denoising`.
   - Set `tile_size` (e.g. 256 or 512) to restore high-resolution images within standard GPU VRAM.
3. **Save Output**:
   - Connect to **`ModusFlow Save Image`** for automatic metadata embedding and variable-based file naming (e.g. `{date}_{seed}_{model}`).

---

### Workflow E: Photorealistic Skin & Anti-Waxy Texture (No LoRAs)

Overcome the plastic, synthetic look caused by constant guidance and aggressive smoothing without needing skin LoRAs:

1. **Inline Sampling Guidance with `Modus Dynamic Guidance`**:
   - Insert between `ModusFlow Model Loader` (or `LoRA Loader`) and `ModusFlow KSampler` using the `pipe` connection.
   - For **Chroma 1-HD / SDXL / Pony**: Set `guidance_mode` to `CFG Scale (Chroma / SDXL / SD1.5)`, `scale_start: 4.5`, `scale_end: 1.8 - 2.0`, and `decay_profile: cosine`.
   - For **Flux.1-dev / SD3**: Set `guidance_mode` to `Flux / SD3 (Distilled Guidance)`, `scale_start: 3.5`, `scale_end: 1.8`, and keep KSampler `cfg: 1.0`.
2. **Decode Latent Image**:
   - Pass through standard VAE Decode to obtain an RGB `image`.
3. **Micro-Texture Reconstruction with `Modus De-Wax Texture Restore`**:
   - Connect `image` and `pipe` into `Modus De-Wax Texture Restore`.
   - Set `micro_texture` (`0.20` - `0.30`) to selectively amplify genuine skin pores and micro-relief.
   - Set `grain_intensity` (`0.05` - `0.08` for natural photorealism, `0.00` - `0.04` for studio glamour) to inject organic sensor noise concentrated in skin mid-tones.
4. **Continue Pipe Stream**:
   - Forward the output `image` and `pipe` directly into `ModusFlow All-in-One Detailer` or `Upscaler`.

---

### Workflow F: Unified Video Generation (Wan 2.1 T2V & I2V)

Generate smooth, high-fidelity videos with seamless switching between Text-to-Video and Image-to-Video:

1. **Load Video Backbone with `ModusFlow Model Loader`**:
   - Model Type: `Diffusion Model (UNet / DiT)`.
   - Select Wan 2.1 weights (e.g. `wan2.1_t2v_1.3B_bf16.safetensors` or `wan2.1_i2v_720p_14B_bf16.safetensors`).
   - Connect UMT5 text encoder and Wan 2.1 video VAE (`wan_2.1_vae.safetensors`).
2. **Spatio-Temporal Latents with `ModusFlow Video Latent Preset`**:
   - Connect `image` (from `LoadImage`) and `vae` (from `ModusFlow Model Loader`).
   - Set **Architecture**: `Wan 2.1 (16ch, 4x time)`.
   - Set **Resolution**: `832x480 (16:9 Landscape)` or `1280x720 (720p 16:9)`.
   - Set **Frames**: `81 frames` (5s @ 16fps) or `49 frames` (3s @ 16fps).
   - **Switching Modes**: Simply change the **mode** dropdown:
     - `Image to Video (I2V)`: Uses the connected image as the initial frame.
     - `Text to Video (T2V)`: Generates pure text-to-video from prompt alone, ignoring the image input without rewiring.
3. **Prompt & Dynamic Guidance**:
   - Set prompt via `ModusFlow Text Editor` into Wan text conditioning.
   - Route through `Modus Dynamic Guidance` with cosine decay to maintain temporal stability and prevent motion burn.
4. **Sample & Encode**:
   - Sample via `ModusFlow KSampler` (e.g. 30 steps, Euler / Simple, CFG 5.0).
   - Decode frames using `VAE Decode`.
   - Route decoded video frames directly into **`ModusFlow Save Video`** to encode to `.mp4` (H.264) or `.webm` with automatic preview.

---

### Workflow G: Automated Video-to-Audio Foley Synchronization (MMAudio)

Generate matching Foley sound effects and ambient sound synchronized to Wan 2.1 / Wan 2.2 video generation:

1. **Setup Video Latents with `ModusFlow Video Latent Preset`**:
   - Choose frame preset (e.g. `81 frames` @ `16.0` fps = 5.062s).
   - Notice the **`duration`** and **`fps`** output pins.
2. **Configure MMAudio Sampler**:
   - Add **MMAudio Video-to-Audio Sampler**.
   - Right-click the node and select **Convert Widget to Input** $\rightarrow$ **duration**.
   - Connect the **`duration`** output from `ModusFlow Video Latent Preset` directly into MMAudio's `duration` input slot.
   - Connect decoded video frames from `VAE Decode` into MMAudio's `video_frames` or `image` input.
3. **Mux Audio with Video**:
   - Pass MMAudio's generated `audio` into **`ModusFlow Audio Mixer & Video Sync`** or directly into **`ModusFlow Save Video`**'s `audio` input.
   - `Save Video` multiplexes the synchronized AAC audio track directly into the rendered MP4/MKV video container.

---

### Workflow H: AI Lyric Studio & Vocal Song Production

Compose original structured songs or refine existing lyrics with web research grounding for ACE-Step or DiffRhythm:

1. **Add `ModusFlow Song Writer & Lyric Studio`**:
   - Set **ai_mode** to `generate_new` (to create a track from scratch) or `refine_existing` (to enhance rhyming and meter).
   - Select **ai_provider**: `Ollama (Local)`, `Ollama (Cloud)`, or `Cloud (OpenAI / OpenRouter / Groq / DeepSeek)`.
   - Set **topic_or_subject**: Describe your song concept, story, or specific adjustments.
   - Set **web_search** to `enabled` to automatically fetch authentic lore and thematic facts via DuckDuckGo.
2. **Execute & Review**:
   - The node generates or refines the title, genre descriptors, vocal delivery style, and formatted lyrics (`[verse]`, `[chorus]`, `[bridge]`).
   - Save the song to your unified library using **💾 Save Song** in the node UI.
3. **Connect to Vocal Generator**:
   - Connect `style_prompt` and `lyrics` into **ACE Step Audio 1.5** or DiffRhythm.
   - Route generated audio into **`ModusFlow Save Audio`** with `%title%` in the filename pattern for automatic naming and tag metadata.

---

## 3. Recommended Node Pairings

| Task | Primary Node | Complementary Nodes |
|------|-------------|---------------------|
| Model & LoRA setup | `ModusFlow Model Loader` | `ModusFlow LoRA Loader`, `ModusFlow Latent Preset` |
| Prompting | `ModusFlow Text Editor` | `ModusFlow Ollama Prompt Refiner`, `ModusFlow ShowText` |
| Multi-encoder models (Flux/SD3) | `ModusFlow Multi-CLIP Text Encode` | `ModusFlow Model Loader` |
| Dynamic Guidance / Anti-Waxing | `Modus Dynamic Guidance` | `ModusFlow KSampler`, `Modus De-Wax Texture Restore` |
| Generation | `ModusFlow KSampler` | `ModusFlow Batch KSampler` |
| Video Latent Generation (T2V & I2V) | `ModusFlow Video Latent Preset` | `ModusFlow Model Loader`, `ModusFlow Save Video` |
| Video-to-Audio Foley Sync | `ModusFlow Video Latent Preset` | `MMAudio Video-to-Audio Sampler`, `Audio Mixer & Video Sync` |
| AI Songwriting & Lyrics | `ModusFlow Song Writer & Lyric Studio` | `ACE Step Audio 1.5`, `ModusFlow Save Audio` |
| Texture & Micro-Detail Restore | `Modus De-Wax Texture Restore` | `Modus Dynamic Guidance`, `ModusFlow All-in-One Detailer` |
| Inpainting & detailing | `ModusFlow All-in-One Detailer` | `ModusFlow Detailer Slot` |
| Upscaling & cleanup | `ModusFlow Upscaler` | `ModusFlow Restormer` |
| Export | `ModusFlow Save Image` | `ModusFlow Save Video`, `ModusFlow Save Audio` |

---

## 4. Tips & Best Practices

- **Zero-Wire Reordering**: In the LoRA Loader, drag LoRAs in the stack to reorder execution or toggle their checkbox to disable without deleting.
- **Pipe Passthrough**: Nodes that accept a `pipe` also emit the updated `pipe`, allowing clean linear chains: `Model Loader -> Dynamic Guidance -> KSampler -> De-Wax Restore -> Detailer`.
- **MMAudio Duration Sync**: By converting MMAudio's `duration` widget to an input and connecting it from `ModusFlow Video Latent Preset`, your Foley audio length always dynamically matches your frame count and FPS.
- **YOLO Models**: Run `python utilities/download_models.py` to populate `models/ultralytics/` with face, hand, and person detector models.
- **Video Memory Optimization**: For Wan 2.1 14B or 720p 81-frame videos, enable `clean_vram` on `ModusFlow Save Video` to purge PyTorch CUDA cache immediately upon rendering.
