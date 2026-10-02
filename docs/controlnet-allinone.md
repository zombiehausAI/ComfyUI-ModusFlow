# ControlNet All-in-One (`ModusFlowControlNetAllInOne`)

The **ModusFlow ControlNet All-in-One** node consolidates the entire ControlNet pipeline into a single node. It combines model selection, intelligent preprocessing (or direct stick figure routing), and pipe-aware conditioning scheduling into one block that drops directly into your ModusFlow generation pipeline.

---

## 🌟 Overview

In standard ComfyUI, using ControlNet requires manually chaining 4 to 6 separate nodes (Load Image $\rightarrow$ Preprocessor $\rightarrow$ ControlNet Loader $\rightarrow$ Apply ControlNet $\rightarrow$ Conditioning rewire $\rightarrow$ KSampler). 

`ModusFlowControlNetAllInOne` replaces all of those with a single node:
- **Direct Stick Figure / OpenPose Support**: Feed pre-made OpenPose stick images directly with zero conversion overhead.
- **Built-in Zero-Dependency Preprocessors**: Automatically turn standard photos into Canny edges, LineArt contours, color maps, or depth proxies.
- **Unified Pipe Compatibility**: Connect a single `PIPE` wire in and out. The positive conditioning is updated with pose guidance while preserving all model, clip, and VAE components.
- **Instant Bypass**: Toggle `control_net_name` to `"None / Bypass"` or set `strength` to `0.0` to disable ControlNet without disconnecting wires.
- **Preprocessed Image Preview**: Emits `preprocessed_image` so you can connect a `Preview Image` node to verify exactly what the AI sees.

---

## 🚀 Beginner's Guide to ControlNet

### What is ControlNet?
ControlNet adds **spatial geometry control** to diffusion models. While text prompts tell the AI *what* to draw (e.g. `"woman in red dress"`), ControlNet tells the AI *where* and *how* to draw it (her exact body pose, hand position, camera angle, or architectural outlines).

### Common Types of ControlNet

| Type | Best Used For | Typical Input |
|---|---|---|
| **OpenPose / DWPose** | Full-body poses, character stances, head tilt, hand gestures | Colored stick figures or human pose skeletons |
| **Canny Edge** | Sharp outlines, clothing folds, mechanical shapes, product silhouettes | High-contrast black & white edge lines |
| **LineArt** | Anime lineart, comic inked drawings, sketches | Clean black-and-white contours |
| **Depth** | 3D room layouts, perspective, foreground/background separation | Grayscale depth maps (white = close, black = far) |

---

## 🔌 How to Connect It

### Method 1: The ModusFlow Pipe Workflow (Recommended)

```
[ModusFlow Model Loader] ──► [Multi-CLIP Text Encode] ──► [ControlNet All-in-One] ──► [KSampler]
                                                                  ▲
[Load Image (Stick Figure or Photo)] ─────────────────────────────┘
                                                                  │
                                                        [Preview Image] (Optional)
```

1. Insert `ModusFlow ControlNet All-in-One` between your Text Encoder and your KSampler.
2. Connect your **PIPE** into the node, and the **PIPE** output to your KSampler.
3. Wire your pose/guide image into the `image` socket.
4. Select your ControlNet model from the `control_net_name` dropdown.

### Method 2: Standard Conditioning (No Pipe)

Connect your existing `positive` and `negative` conditioning from your text encoder into the node's `positive` and `negative` inputs. Connect the node's `positive` and `negative` outputs to your KSampler.

---

## ⚙️ Parameters & Settings

### Required Inputs
* **`control_net_name`** (dropdown): All models located in your `ComfyUI/models/controlnet/` directory. Set to `"None / Bypass"` to temporarily disable guidance.
* **`preprocessor`**:
  * `None (Direct / Stick Image)`: Select this when your input is **already** an OpenPose stick skeleton, a depth map, or a pre-rendered canny mask. No processing is applied.
  * `Canny Edge`: Computes edge contours from any standard photo.
  * `LineArt (Adaptive Threshold)`: Computes clean lineart sketch contours.
  * `Color / Palette Guidance`: Blurs colors for broad composition and lighting matching.
  * `Blur / Tile (Low-Res Guide)`: Tile-based guidance for super-resolution and detail re-synthesis.
  * `Luminance / Depth Proxy`: Converts luminance gradients into a depth-like contour map.
* **`strength`** (float, default `1.0`): Guidance intensity.
  * `1.0`: Strict adherence to the pose.
  * `0.70 - 0.85`: **Recommended sweet spot**. Locks in the pose while allowing the AI freedom to render natural skin, clothing folds, and hair flow.
  * `0.0`: Completely bypasses ControlNet.
* **`start_percent`** (float, default `0.0`): Step percentage when ControlNet begins guiding (0.0 = step 1).
* **`end_percent`** (float, default `1.0`): Step percentage when ControlNet stops guiding.
  * *Pro Tip*: Setting `end_percent: 0.60 - 0.70` locks the pose early in generation, then turns ControlNet off for the final 30-40% of sampling steps. This gives the base model full freedom to render crisp eyes, fingers, and micro-textures without geometric interference.

### Optional Inputs
* **`image`** (IMAGE): Guiding reference photo or OpenPose stick image.
* **`pipe`** (PIPE): ModusFlow unified pipeline.
* **`positive`** (CONDITIONING): Direct positive conditioning.
* **`negative`** (CONDITIONING): Direct negative conditioning.
* **`low_threshold`** / **`high_threshold`** (INT): Fine-tuning thresholds used when running Canny or LineArt preprocessors.

### Outputs
* **`pipe`** (PIPE): ModusFlow pipe carrying the pose-guided positive conditioning directly to KSampler.
* **`positive`** (CONDITIONING): Conditioned positive prompt embedding.
* **`negative`** (CONDITIONING): Passthrough negative conditioning.
* **`preprocessed_image`** (IMAGE): The exact visual map (edge contour or stick skeleton) fed to the neural network. Connect to a `Preview Image` node to verify alignment.

---

## 💡 Practical Tips for Posing

### Using Stick Figures with Multiple People
OpenPose stick figures do not have gender colors. To make one person male and another female:
1. **Positional Prompts**: Describe positions explicitly in your text prompt (e.g. `"photo of a tall man standing on the left in a dark suit, and a woman sitting on the right in a white summer dress"`).
2. **Body Proportions**: Skeletons with wider shoulders and narrower hips will naturally bias the model toward a male figure; skeletons with narrower shoulders and wider hips bias toward female figures.
3. **End Step Scheduling**: Use `end_percent: 0.65` so the pose is locked early, leaving the remainder of the sampling steps for the text prompt to resolve faces, hair, and clothing without fighting the stick skeleton.
