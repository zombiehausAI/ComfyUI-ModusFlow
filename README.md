# ModusFlow


[![Release](https://img.shields.io/github/v/release/zombiehausAI/ComfyUI-ModusFlow?color=blue&label=release)](https://github.com/zombiehausAI/ComfyUI-ModusFlow/releases)
[![Main Build](https://img.shields.io/github/actions/workflow/status/zombiehausAI/ComfyUI-ModusFlow/release-and-versioning.yml?branch=main&label=main&logo=github)](https://github.com/zombiehausAI/ComfyUI-ModusFlow/actions/workflows/release-and-versioning.yml?query=branch%3Amain)
[![Dev Version](https://img.shields.io/github/package-json/v/zombiehausAI/ComfyUI-ModusFlow/dev?filename=vscode-extension%2Fpackage.json&label=dev&color=orange)](https://github.com/zombiehausAI/ComfyUI-ModusFlow/tree/dev)
[![Dev Build](https://img.shields.io/github/actions/workflow/status/zombiehausAI/ComfyUI-ModusFlow/release-and-versioning.yml?branch=dev&label=dev%20build&logo=github)](https://github.com/zombiehausAI/ComfyUI-ModusFlow/actions/workflows/release-and-versioning.yml?query=branch%3Adev)
[![License](https://img.shields.io/badge/License-MIT-brightgreen)](LICENSE)
[![Ko-fi](https://img.shields.io/badge/Ko--fi-Support-FF5E5B?logo=ko-fi&logoColor=white)](https://ko-fi.com/zombiehaus)

> [!NOTE]
> **AI-Assisted Development**: These custom nodes, UI extensions, scripts, and documentation were created with AI assistance. In the spirit of complete transparency: if you prefer not to use AI-assisted code, please feel free to pass on this custom node suite.
>
> This project is AI Assisted, by AI for AI

A comprehensive collection of professional-grade custom nodes for ComfyUI, featuring AI-powered prompt refinement, advanced model loading, multi-section detailing, tiled upscaling, and sophisticated batch processing workflows.

---

## 🌟 Overview

ComfyUI-ModusFlow provides 22 custom nodes organized into six categories:

**🤖 AI & Prompt Enhancement**
- Ollama Prompt Refiner - Full-pipeline prompt enhancement with Ollama LLMs, conditioning output, and pipe support
- Ollama Text Refiner - Lightweight text refinement via Ollama
- Image For Prompting - Metadata extraction and AI-powered image descriptions

**📦 Model & Resource Loading**
- Model Loader - UNet/checkpoint, multi-CLIP (DualCLIP + up to 4 individual), and VAE loader
- LoRA Loader - Stack-based LoRA management with validation and Civitai integration
- Multi-CLIP Text Encode - Per-CLIP text inputs with Flux guidance and single conditioning output

**🎨 Sampling & Generation**
- KSampler - Enhanced sampler with pipe support, audio latent handling, and CUDNN control
- Batch KSampler - Simplified KSampler for batch workflows
- Latent Preset - Blank latent generator with common resolution presets
- Modus Dynamic Guidance - Sampling-level dynamic guidance hook to address plastic, waxy skin tones without LoRAs

**🖼️ Image Enhancement & Post-Processing**
- Detailer Slot - Config bundle for one YOLO detection + inpaint pass
- All-in-One Detailer - Runs any number of Detailer Slots sequentially with pipe support
- Model Upscale - All-in-one neural upscaler (e.g. 4x-UltraSharp) with optional downscale and pre-downscale upscale saving
- Upscaler - Tiled upscaling with seam fixing and post-processing
- Restormer - Deep learning image restoration (motion deblur, defocus, denoising)
- Modus De-Wax Texture Restore - Post-decode micro-texture reconstruction and organic sensor grain restoration

**🔊 Audio & Video**
- Save Audio - Multi-format audio export (flac, wav, mp3, ogg) with filename variables
- ACE Step Audio 1.5 - TextEncodeAceStepAudio1.5 with song save/load for tags and lyrics into unified library
- Song Writer & Lyric Studio - Interactive AI lyric studio (Ollama local/cloud, OpenAI-compatible cloud LLMs, DuckDuckGo web research grounding), structured lyric templates, musical styles, and unified save/load library
- Audio Mixer & Video Sync - Blends sound effects (MMAudio) with background music tracks for video muxing
- Video Latent Preset - Wan 2.1 & Wan 2.2 spatio-temporal video latent generator with native I2V/T2V, plus `duration` and `fps` outputs for automated MMAudio synchronization
- Save Video - Multi-format video export (H.264, HEVC, VP9) with AAC audio muxing and interactive preview

**⚙️ Conditioning & Guidance**
- ControlNet All-in-One - Complete all-in-one ControlNet pipeline (model loading, preprocessors, stick figure routing, and pipe scheduling)
- ControlNet Loader & Apply - Direct ControlNet model loader and pipe-aware conditioning application
- Image Preprocessor - Zero-dependency preprocessor (Canny, LineArt, Color, Tile, Luminance Proxy)
- Conditioning Concat - Encode text and concatenate onto existing conditioning

**🛠️ Utilities & Prompting**
- Master Seed - Centralized master seed generator and synchronizer (randomize, fixed, increment, decrement)
- Smart Resizer - Aspect ratio optimization and smart cropping/padding for diffusion models
- Show Text - Simple text display for prompts, LoRA logs, and debugging
- Text Editor - Interactive text editor with live syntax highlighting, intelligent autocomplete (__lists__, $vars, %sys%, <loras>), tag weight stepping (Ctrl+Up/Down), negative presets, direct CLIP conditioning, pipe passthrough, and category-filtered save/load
- List Curator - Curated trait pool selector with on-canvas editor, live syntax highlighting, item counter, and autocomplete
- Ollama Prompt Refiner - Prompt enhancement with category-filtered save/load to unified prompts library
- Image Gallery - Browse output directory with metadata viewing
- Save Image - Save images in PNG/JPEG/WebP with filename variables and metadata embedding

---

## ✍️ ModusFlow Text Editor & Prompt Studio

The **ModusFlow Text Editor** turns ComfyUI prompt crafting into a full-featured IDE. Designed for creators who build complex, dynamic, and multi-character workflows, it replaces plain text boxes with live syntax highlighting, programming-grade dynamic templating, seamless prompt-driven LoRA loading, and an expansive Pop-Out Studio.

```
                      ┌──────────────────────────────────────────────┐
                      │   ModusFlow Text Editor & Prompt Studio      │
                      ├──────────────────────────────────────────────┤
                      │ • Live Syntax Highlighting & Dark Themes     │
                      │ • Modular File Imports: @import "lib/file"   │
                      │ • Reusable Macro Functions: @func($arg)      │
                      │ • Dynamic CASE & Switch Branching            │
                      │ • Compound Boolean Ternaries (&&, ||, !)     │
                      │ • Percentage Chance Modifiers: {40%: tags}   │
                      │ • Inline Arithmetic: {$weight + 0.2}         │
                      │ • Null-Coalescing Operator: $var ?? fallback │
                      │ • Filter Pipes: $tag | plural | upper        │
                      │ • Arrays, Lists & Dicts: $obj.prop, $arr[0]  │
                      │ • Loops & Repetition: repeat(3), for $c in L │
                      │ • Seamless Dynamic LoRA Prompt Tagging       │
                      │ • Tag Weight Stepping (Ctrl+Up/Down)         │
                      │ • Cross-Model Linguistic Weight Translation  │
                      └──────────────────────┬───────────────────────┘
                                             │
             ┌───────────────────────────────┴───────────────────────────────┐
             ▼                                                               ▼
   [Direct CLIP Conditioning]                                     [Clean Prompt String]
   • Encoded with active CLIP                                     • Stripped of raw tags
   • Injected with LoRA metadata                                  • Ready for preview & metadata
   • Seamless LoRA Loader link                                    • Clean generation prompt
```

### ✨ Key Features at a Glance

| Feature | Description |
|---|---|
| **📁 Modular File Imports** | Import and compose external prompt files with `@import "styles/cyberpunk"` or `@import "lighting.txt"`. Works seamlessly with `.txt` (raw text, YAML dicts, or multi-entry dict lists) and `.json` (saved prompts or data objects/arrays) relative to `saved_prompts` root or subfolders. Supports assigning to variables (`$hero = @import "hero.txt";`), direct loop iteration (`for $m in @import "heroes.txt"`), and 5-level recursion guards. |
| **⚡ Reusable Macro Functions** | Define parameterized prompt functions: `fn hero($name, $weapon) = { masterpiece portrait of $name holding a glowing $weapon };` and invoke them anywhere with `@hero("valkyrie", "sword")`. Supports variable passing, multi-line bodies, and clean definition stripping. |
| **📦 Arrays, Lists & Wildcard Data Structures** | First-class data structures: declare lists `$elements = [fire, frost, lightning];` and maps `$hero = { name: "Valkyrie", role: "tank" };`. Wildcard list files can also contain YAML key-values (`$hero = __hero__;` $\rightarrow$ `$hero.name`, `$hero.role`) or multi-entry dictionary lists (`__heroes__` rolls 1 random dict, `__all$$heroes__` imports all into a list, or loop directly via `for $m in __heroes__`). Access items with dot notation (`$hero.name`), bracket indexing (`$elements[0]`, `$hero["weapon"]`), or array lengths (`$elements.length`). Works with dedicated filters (`\| keys`, `\| values`, `\| first`, `\| last`, `\| reverse`, `\| sort`). |
| **🔁 Loops & Repetition** | Parametric generation loops: `repeat(count) { ... }` with auto `$index` (1-based) / `$i` (0-based) and re-rolling dynamic choices per iteration; `for $item in $list { ... }`, `for $idx, $item in $list { ... }`, dictionary key-value loops `for $k, $v in $dict { ... }`, multi-character squad loops `for $m in $party { $m.name as $m.role }`, and numerical ranges `for $i in 1..4 { ... }`. Bounded safely to 20 iterations max. |
| **🔀 CASE / Switch Statements** | Multi-branch conditionals that map variables to distinct character traits, outfits, or LoRAs: `{case $person: man => sharp suit \| woman => red dress \| * => casual outfit}`. Supports single-line with `\|` or multi-line with newlines, comma grouping (`man, boy => ...`), and choice sets (`{man\|boy} => ...`). |
| **❓ Compound Boolean Ternaries** | Full boolean logic branching with `&&`, `\|\|`, and `!`: `{$is_night && $weather == "rain" ? stormy night : clear day}` or `{($level >= 50 \|\| $role in {paladin\|hero}) && $is_night ? veteran : rookie}`. |
| **🎲 Percentage Chance Modifiers** | Probabilistic tag inclusion: `{40%: dramatic volumetric dust, }` or `{25.5%: cybernetic arm}` rolls a random percentage probability per generation, cleanly resolving to empty string if the chance fails. |
| **🧮 Inline Arithmetic Expressions** | Real-time mathematical operations directly inside prompts or attention weights: `(masterpiece:{$base_weight + 0.2})` $\rightarrow$ `(masterpiece:1.3)`, `{$level * 2}`, `{$age + 10}`. |
| **🛡️ Null-Coalescing Operator** | Safe fallback resolution for unset or empty variables: `$theme ?? "cyberpunk"` or `{$missing_var ?? "high tech"}`. |
| **🧪 Unix / Jinja Filter Pipes** | Transform variables with piped filters: `$creature \| plural \| upper` $\rightarrow$ `WOLVES`, `$tags \| strip_weights` (cleans tags to unweighted plain text), `$colors \| join(" + ")`, `$hero \| title`, and `$tag \| weight(1.3)`. Safely isolated to never collide with dynamic choices! |
| **🔮 Seamless LoRA Prompt Tagging** | Tag `<lora:name:strength>` directly inside your prompt or CASE branches. The Text Editor completely strips the tag from the text (no prompt pollution or metadata leaking) and invisibly transmits the LoRA payload to the **ModusFlow LoRA Loader** via the existing conditioning connection. |
| **🎲 Dynamic Choices & Pick-N** | Standard choices `{day\|night}`, Pick-N sets `{2$$neon\|retro\|cyberpunk}`, and weighted probabilities `{80::sunny\|20::rainy}`. |
| **🔄 Deterministic Sequencing** | Step through options sequentially per queue or batch: `{seq: dawn \| midday \| golden hour \| midnight}` loops systematically with each generation. |
| **🔗 Synced Choice Tuples** | Roll multi-variable attribute sets in lockstep: `[$theme, $hair, $eyes] = {[fire, crimson, amber] \| [ice, silver, blue]};`. |
| **⌨️ Intelligent Autocomplete** | Instant popup autocomplete triggered by `<l` (installed LoRAs with auto-normalized slashes), `__` (wildcard list files), `$` (variables), and `%` (workflow macros). |
| **🎯 Tag Weight Stepping** | Highlight any tag and press `Ctrl+Up` / `Ctrl+Down` to step attention weights (`(tag:1.1)` $\leftrightarrow$ `(tag:1.2)`), or wrap words with parentheses automatically. |
| **🌐 Linguistic Weight Translation** | Automatic real-time translation between SDXL/Pony token weights (`(word:1.3)`) and natural language emphasis for Chroma and Flux T5 (`strikingly intense word, emphasizing word`), Front-Load Priority mode, or clean weight stripping. |
| **📦 Multiline Variable Blocks** | Define reusable multiline variables with `$character = { ... };` or triple quotes `""" ... """`, with full support for inline comments (`//`, `/* */`, `#`). |
| **🚫 Inline Negative Injections** | Inject negative constraints right where you think of them in the positive prompt with `{!neg: blur, deformed}`—automatically deduplicated into the negative prompt. |

> 📖 **Deep Dive Documentation**: Check out the comprehensive **[ModusFlow Text Editor Documentation](docs/text-editor.md)** and the **[Text Editor & Wildcard Mastery Guide](docs/guides/text-editor-mastery.md)** for advanced syntax examples, workflow integration patterns, and best practices.

---

## 💾 Installation

1. Navigate to ComfyUI custom_nodes directory:
   ```bash
   cd ComfyUI/custom_nodes/
   ```

2. Clone this repository:
   ```bash
   git clone https://github.com/ModusFlow/ComfyUI-ModusFlow.git
   ```

3. Install dependencies:
   ```bash
   cd ComfyUI-ModusFlow
   pip install -r requirements.txt
   ```
   *Installs core dependencies including `ultralytics` (for YOLO detection in All-in-One Detailer) and `av` (for multi-format audio encoding in Save Audio).*

4. Restart ComfyUI

---

## ⚙️ Configuration

### Option A: ComfyUI Settings UI (Recommended)
You can configure ModusFlow directly within ComfyUI without editing any files:
1. Click the **⚙️ Settings** icon in ComfyUI (top bar or sidebar).
2. Locate the **ModusFlow** category.
3. Configure your settings directly:
   - **Ollama URL**: Local Ollama server address (default: `http://127.0.0.1:11434`)
   - **Ollama Cloud URL**: Remote Ollama endpoint URL
   - **Ollama Cloud API Key**: Bearer token for authenticated remote Ollama servers
   - **Cloud API URL**: OpenAI-compatible endpoint (default: `https://openrouter.ai/api/v1`, Groq, DeepSeek, OpenAI)
   - **Cloud API Key**: API key for cloud LLM providers
   - **Cloud Models**: Comma-separated list of cloud models for dropdowns
   - **Civitai API Key**: For LoRA preview images and metadata
   - **Prompts Directory Override**: Custom path for saved prompts and song libraries
   Changes apply immediately in real time.

### Option B: `config.json` File
Alternatively, create a `config.json` file in the node directory:

```bash
cp config.json.example config.json
```

Edit `config.json` to configure:
- `ollama_url` - Ollama API endpoint (default: `http://127.0.0.1:11434`)
- `ollama_cloud_url` - Remote/cloud Ollama endpoint
- `ollama_cloud_api_key` - Remote Ollama authentication token
- `cloud_api_url` - OpenAI-compatible chat completions endpoint
- `cloud_api_key` - Cloud LLM API key
- `cloud_model` - Default cloud model identifier
- `cloud_models` - List of pre-populated cloud models
- `ollama_timeout` - Timeout in seconds for LLM requests (default: `120`)
- `civitai_api_key` - For LoRA preview images and metadata
- `prompts_save_directory` - Custom path for saved prompts (optional)
- `base_model_definitions` - Custom model architecture definitions (Flux, SDXL, Pony, etc.)

---

## 📖 Documentation

- 🧭 **[Workflow & Node Usage Guide](docs/workflow-guide.md)** — Step-by-step guide to connecting nodes, pipe-driven workflows, detailing passes, and upscaling.
- 🦄 **[Pony V6: Face & Quality Mastery Guide](docs/guides/pony-v6-faces-and-quality.md)** — Secrets to generating clean, sharp, distortion-free faces, eyes, and anatomy in Pony Diffusion V6 XL.
- 📝 **[Text Editor & Wildcard Mastery Guide](docs/guides/text-editor-mastery.md)** — Model weight translation (Chroma/Flux T5 vs. SDXL/Pony), front-loading priority, tag shuffling `{shuffle: ...}`, deterministic seeds, inline choices `{a|b}`, strict `saved_prompts` wildcards, and on-canvas list curation.
- 💄 **[Glamour & Body Sculpting Studio Guide](docs/glamour-and-body-sculpting.md)** — Guide to multi-zone character remodeling: age, ethnicity, hair color, eye detailing, waist/hips, chest/torso, and hands with context padding.
- 🖥️ **[ModusFlow Studio Specification](docs/MODUSFLOW_STUDIO_SPEC.md)** — Architecture & technical specification for the standalone cross-platform Photino.Blazor desktop workstation.

### Node Documentation

**AI & Prompt Enhancement**
- [Ollama Prompt Refiner](docs/ollama-prompt-refiner.md)
- [Ollama Text Refiner](docs/ollama-text-refiner.md)
- [Image For Prompting](docs/image-for-prompting.md)

**Model & Resource Loading**
- [Model Loader](docs/model-loader.md)
- [LoRA Loader](docs/lora-loader.md)
- [Multi-CLIP Text Encode](docs/multi-clip-text-encode.md)

**Sampling & Generation**
- [KSampler](docs/ksampler.md)
- [Batch KSampler](docs/batch-ksampler.md)
- [Latent Preset](docs/latent-preset.md)
- [Video Latent Preset](docs/video-latent.md)
- [Modus Dynamic Guidance](docs/dynamic-guidance.md)
- [ModusFlow Chroma Shift](docs/tools-and-utilities.md) (Flow-Matching Timestep Shifting for Chroma & Flux)
- [Img2Img & Fidelity Controller](docs/img2img-fidelity.md) (All-in-One VAE Encode, Modular VAE Encode, Fidelity Slider, Load Image)
- [VAE Decode & Latent Tools](docs/tools-and-utilities.md) (Tiled VAE Decode, Latent Upscale / Hires Fix)

**Image Enhancement & Post-Processing**
- [All-in-One Detailer](docs/allinone-detailer.md)
- [Face Swapper](docs/faceswap.md) (Photo-to-Photo Face Swapping, Alignment & Lighting Match)
- [Glamour & Body Sculptor](docs/glamour-and-body-sculpting.md) (Interactive Sliders for Bust, Waist, Hips, Age, and Glamour)
- [Model Upscale (All-in-One)](docs/tools-and-utilities.md) (Neural Model Upscale with Bypass & Downscaling)
- [Upscaler](docs/upscaler.md) (Diffusion Tiled Upscaling)
- [Restormer](docs/restormer.md)
- [Modus De-Wax Texture Restore](docs/dewax-texture-restore.md)
- [Compare Images (A/B Split)](docs/tools-and-utilities.md)
- [Mask Tools](docs/tools-and-utilities.md) (Grow/Shrink, Blur, Invert)

**Video & Audio**
- [Save Video](docs/save-video.md)
- [Save Audio](docs/save-audio.md)
- [Song Writer & Lyric Studio](docs/song-writer.md)
- [Audio Mixer & Video Sync](docs/audio-mixer.md)
- [ACE Step Audio 1.5](docs/ace-step-audio.md)

**Conditioning & Control**
- [ControlNet Suite](docs/tools-and-utilities.md) (Pipe-Aware ControlNet Apply & Loader)
- [Conditioning Concat](docs/conditioning-concat.md)

**Utilities**
- [Show Text](docs/show-text.md)
- [Text Editor](docs/text-editor.md) (with Weight Translation, Dynamic Prompts & Wildcards)
- [List Curator](docs/guides/text-editor-mastery.md) (Wildcard Curation & Sampling)
- [Prompt Mixer](docs/guides/text-editor-mastery.md) (Modular Prompt Layer Builder & Stacker)
- [Image Gallery](docs/image-gallery.md)
- [Save Image](docs/save-image.md)

### 📂 Example Workflows

Pre-configured sample workflows with optimal defaults and pipe-driven architecture are provided in the [`workflows/`](workflows/) directory:
- **[Glamour and Body Sculpting Studio (ModusFlow).json](workflows/Glamour%20and%20Body%20Sculpting%20Studio%20(ModusFlow).json)**: Multi-zone portrait & anatomy transformation pipeline controlling face/age/ethnicity, eyes, chest, waist/hips/curves, and hands with De-Wax micro-pore restoration and A/B compare.
- **[FaceSwap - LoRA (ModusFlow).json](workflows/FaceSwap%20-%20LoRA%20(ModusFlow).json)**: "Load and forget" face/character swapping pipeline utilizing trained character LoRAs, face detection inpainting, De-Wax skin texture restoration, and A/B comparison.
- **[FaceSwap - Reference Photo (ModusFlow).json](workflows/FaceSwap%20-%20Reference%20Photo%20(ModusFlow).json)**: Photo-to-photo face swapping with zero LoRA training using the native `ModusFlow Face Swapper`, Reinhard color & lighting transfer, and Detailer lighting unification.
- **[Outfit Changer (ModusFlow).json](workflows/Outfit%20Changer%20(ModusFlow).json)**: Wardrobe replacer & styling pipeline that in-paints new clothing, suits, or outfits while keeping face likeness, anatomy, and background intact.
- **[Chroma Img2Img All-in-One (ModusFlow).json](workflows/Chroma%20Img2Img%20All-in-One%20(ModusFlow).json)**: Chroma 1-HD image-to-image workflow using the All-in-One `ModusFlow Img2Img VAE Encode` node with single-slider fidelity control (0–100%) and 100% ModusFlow nodes.
- **[Chroma Img2Img Modular (ModusFlow).json](workflows/Chroma%20Img2Img%20Modular%20(ModusFlow).json)**: Chroma 1-HD image-to-image workflow using separate `ModusFlow Load Image`, `ModusFlow VAE Encode`, and `ModusFlow Fidelity Controller` nodes.
- **[Wan2.2 (ModusFlow).json](workflows/Wan2.2%20(ModusFlow).json)**: Production Wan 2.2 Video Diffusion workflow with native 48-channel latent masking for Image-to-Video (I2V) and Text-to-Video (T2V).
- **[Wan2.2 + MMAudio (ModusFlow).json](workflows/Wan2.2%20%2B%20MMAudio%20(ModusFlow).json)**: Wan 2.2 video generation with automated video-to-audio Foley synchronization via MMAudio, muxed into final MP4.
- **[DiffRhythm Song Studio (ModusFlow).json](workflows/DiffRhythm%20Song%20Studio%20(ModusFlow).json)**: Complete full-song vocal music studio with structured lyrics, style prompts, and 320kbps MP3 audio export.
- **[Wan2.1 (ModusFlow).json](workflows/Wan2.1%20(ModusFlow).json)**: Wan 2.1 Video Diffusion workflow with unified Text-to-Video (T2V) and Image-to-Video (I2V) toggle, spatio-temporal latents, and in-house video encoding.
- **[Wan2.2 Image (ModusFlow).json](workflows/Wan2.2%20Image%20(ModusFlow).json)**: Wan 2.2 Still Image Generation workflow with 48-channel 5D latents, Dynamic Guidance decay, full 12-slot detailing pipeline, and Restormer / 4x Remacri upscaling.
- **[Chroma (ModusFlow).json](workflows/Chroma%20(ModusFlow).json)**: Chroma 1-HD de-distilled Flux with CFG scale decay and anti-waxing pipe.
- **[Flux1.Dev (ModusFlow).json](workflows/Flux1.Dev%20(ModusFlow).json)**: Flux.1-dev with dual CLIP (T5 + CLIP-L) and distilled guidance decay.
- **[SD3.5 (ModusFlow).json](workflows/SD3.5%20(ModusFlow).json)**: Stable Diffusion 3.5 Large with SGM Uniform scheduler and distilled guidance decay.
- **[SDXL (ModusFlow).json](workflows/SDXL%20(ModusFlow).json)**: SDXL base workflow with DPM++ 2M Karras, true CFG decay, and micro-texture restore.
- **[SD1.5 (ModusFlow).json](workflows/SD1.5%20(ModusFlow).json)**: SD 1.5 checkpoint workflow with 512x512 latent preset and full detailing pass.
- **[Pony V6 (ModusFlow).json](workflows/Pony%20V6%20(ModusFlow).json)**: Pony Diffusion V6 XL with CLIP skip -2, score prompt tags, and Euler Ancestral.
- **[Illustrious (ModusFlow).json](workflows/Illustrious%20(ModusFlow).json)**: Illustrious-XL with CLIP skip -2, Danbooru anime tags, and Euler Normal.

---

## 🎯 Quick Start

### Basic Generation Workflow
```
Model Loader → Multi-CLIP Text Encode → KSampler → VAE Decode
```

### Photorealism & Anti-Waxy Skin Pipeline (No LoRAs)
Eliminate plastic, waxy skin tones and over-baked contrast through a two-stage process (sampling decay + post-decode texture restoration):
```
[Model Loader] ── PIPE ──► [Modus Dynamic Guidance] ── PIPE ──► [KSampler] ──┬── IMAGE ──► [Modus De-Wax Texture Restore] ──► [Save Image]
                                                                             └── PIPE   ──►
```
- **Stage 1 (Sampling)**: **[Modus Dynamic Guidance](docs/dynamic-guidance.md)** dynamically decays guidance strength (e.g. `4.5` → `1.8` via `cosine` curve). Preserves composition and prompt adherence in early steps while eliminating the synthetic plastic gloss and harsh saturation caused by constant guidance.
  - *Chroma 1-HD / SDXL / Pony*: Use `CFG Scale (Chroma / SDXL / SD1.5)` mode (`scale_start: 4.5`, `scale_end: 1.8-2.0`).
  - *Flux.1-dev / SD3*: Use `Flux / SD3 (Distilled Guidance)` mode (`scale_start: 3.5`, `scale_end: 1.8`, KSampler `cfg: 1.0`).
- **Stage 2 (Post-Processing)**: **[Modus De-Wax Texture Restore](docs/dewax-texture-restore.md)** uses GPU-accelerated frequency separation and ITU-R BT.709 relative luminance weighting to amplify genuine skin pores (`micro_texture: 0.20-0.30`) and inject subtle, organic sensor grain into skin mid-tones (`grain_intensity: 0.05-0.08`).

### AI Prompt Enhancement
```
Text → Ollama Prompt Refiner → CLIP Text Encode → Generation
```

### Detail Enhancement
```
KSampler → image → All-in-One Detailer → Upscaler → Save Image
```

---

## 🔧 Requirements

- ComfyUI (latest version recommended)
- Python 3.8 or higher
- For Ollama nodes: Ollama installed with at least one model (`ollama pull llava`)
- For All-in-One Detailer: `pip install ultralytics` (YOLO detection models)
- For Restormer: `pip install einops`
- For Upscaler: Upscale models in `ComfyUI/models/upscale_models/`

---

## 💻 ModusFlow Prompt Studio for VS Code & Cursor

ComfyUI-ModusFlow includes an official companion extension for VS Code, Cursor, and Windsurf located in [`vscode-extension/`](vscode-extension/):

- **🎨 Full ModusFlow Syntax Highlighting**: Rich TextMate grammar for dynamic choices (`{a|b|c}`), weighted odds (`{80::day|20::night}`), wildcards (`__lighting__`), variables (`$var`), attention weights (`(tag:1.2)`), and LoRA tags (`<lora:name:weight>`).
- **🌈 Document Color Provider & Natural Color Resolver**: Live color swatches on `#hex` codes with built-in color picker and nearest natural color name resolution.
- **🤖 Ollama Selection Inpainting**: Highlight any word or phrase and right-click to expand, audition visual synonyms, wrap into `{choice|choice}` blocks, or translate between tags and prose.
- **💡 Rich IntelliSense & Autocomplete**: Autocomplete for installed wildcards (`__`), LoRA models (`<lora:`), and prompt macros (`!cine`, `!photo`, `!anime`, `!neg`).
- **🖼️ LoRA Hover Cards**: View Civitai preview thumbnails, authors, and trained trigger tags on hover.
- **🎵 Songwriter & Lyrics Studio Cockpit**: Seamlessly switch between Image Prompts and Songwriter & Lyric Studio modes. Structure musical lyrics with live section syntax highlighting (`[Verse]`, `[Chorus]`, `[Bridge]`), quick section ribbons, musical style pedals (*Studio Master*, *Analog Warmth*, *Punchy 808*, *Radio Ready*, *Vocal Air*, *Acoustic Live*, *Atmospheric Strings*), and save directly into your ComfyUI song collection.
- **📚 Saved Songs & Lyrics Library**: Dedicated sidebar tree view to browse, preview, and load saved songs grouped by genre and category directly from ComfyUI.
- **📁 Activity Bar Library Explorer**: Browse saved prompts and edit wildcard files side-by-side.
- **🚀 One-Key Generation Queue (`Ctrl+Alt+Enter`)**: Trigger ComfyUI generation directly from your IDE.

### Install the Extension
Download the latest `.vsix` package from the [Releases](https://github.com/zombiehausAI/ComfyUI-ModusFlow/releases) page or compile it locally, then install via:
```bash
code --install-extension vscode-extension/modusflow-prompt-studio-*.vsix
```
*Or in VS Code / Cursor / Windsurf: Press `Ctrl + Shift + P` $\rightarrow$ `Extensions: Install from VSIX...` $\rightarrow$ Select the downloaded `.vsix` file.*

---

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details

---

## 🙏 Credits

- ComfyUI team for the excellent framework
- Ollama for local LLM capabilities
- Ultralytics for YOLO models
- Segment Anything team for SAM
- Community for feedback and testing

---

## ☕ Support & Contributions

If you find ModusFlow helpful for your ComfyUI generation pipelines and prompt workflows, consider supporting ongoing development:

[![Support me on Ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/zombiehaus)

- **Issues**: [Report bugs or request features](https://github.com/dworden42/ComfyUI-ModusFlow/issues)
- **Discussions**: [Ask questions and share workflows](https://github.com/dworden42/ComfyUI-ModusFlow/discussions)

