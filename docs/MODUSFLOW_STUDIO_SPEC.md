# ModusFlow Studio Specification

This document provides the technical integration specification for **ModusFlow Studio** (the cross-platform desktop application powered by Photino.Blazor and C# / TypeScript) to interface with the **ComfyUI-ModusFlow** custom node ecosystem.

---

## 1. Overview & Architecture

ModusFlow Studio connects to ComfyUI over HTTP and WebSockets:
- **Node Metadata & Introspection**: `GET /object_info` — ModusFlow Studio queries this endpoint to dynamically read all node classes, input types, slider boundaries (`min`, `max`, `step`, `default`), and dropdown options.
- **Workflow Execution**: `POST /prompt` — Dispatches execution graphs formatted as serialized ComfyUI API prompt payloads.
- **Real-Time Progress**: `WS /ws?clientId={clientId}` — ModusFlow Studio listens for execution events (`executing`, `progress`, `executed`).
- **Artifact Retrieval**: `GET /view?filename={filename}&type=output` — Fetches rendered images, audio, and video files.

All ModusFlow nodes are categorized under `CATEGORY = "ModusFlow"` or subcategories like `ModusFlow/Detailing`, `ModusFlow/Styling`, and `ModusFlow/Generative`.

---

## 2. Ingesting Workflows from `workflows/`

ModusFlow Studio can load any of the pre-built `.json` files in the repository's `workflows/` folder:

| Workflow File | Key Target Model | Primary Studio Controls |
|---|---|---|
| `Glamour and Body Sculpting Studio (ModusFlow).json` | ChromaHD-1 / Flux / SDXL | Anatomy sliders (`breasts_scale`, waist, hips, muscle tone, age, glow) |
| `Virtual Studio Director and Relighting (ModusFlow).json` | All Models | Optics dropdowns, studio lighting, background replacement |
| `Style and Aesthetic Studio (ModusFlow).json` | All Models | Visual movement dropdown, color harmony palette, aesthetic strength |
| `All-in-One Hires Fix and Polish (ModusFlow).json` | All Models | Upscale factor slider, denoise slider, Civitai export recipe card |
| `FaceSwap - Reference Photo (ModusFlow).json` | All Models | Target image picker, source face picker, blend feather slider |
| `FaceSwap - LoRA (ModusFlow).json` | All Models | Character LoRA selector, LoRA strength slider |
| `Outfit Changer (ModusFlow).json` | All Models | Target clothing prompt, clothing mask denoise slider |
| `Chroma (ModusFlow).json` | ChromaHD-1 | Fast prompt text area, CFG/guidance, seed controller |
| `Flux1.Dev (ModusFlow).json` | Flux.1-dev | DiT guidance slider, resolution preset, latent sampler |
| `SDXL (ModusFlow).json` | SDXL | Base prompt, style conditioning, refiner switch |
| `Wan2.2 (ModusFlow).json` | Wan2.2 Video | Frame count slider, FPS slider, motion strength |
| `DiffRhythm Song Studio (ModusFlow).json` | DiffRhythm | Lyrics text editor, genre selector, audio duration |

### How Studio Ingests Workflow Files:
1. Parse the workflow JSON.
2. Search for nodes where `class_type` starts with `ModusFlow`.
3. Auto-bind the input widgets to corresponding Studio native UI controls (sliders, color pickers, dropdown selects).
4. On execution, inject the user's studio UI state into the target node's `inputs` dictionary before posting to `/prompt`.

---

## 3. High-Value Studio Node Schemas

### A. `ModusFlowGlamourController`
Designed specifically for interactive character styling and anatomical sculpting:
- **`breasts_scale`** (`FLOAT`): `min: -5.0`, `max: 5.0`, `step: 0.1`, `default: 0.0`, `display: "slider"`
  - `< 0.0`: Reduces chest volume, athletic compression, tailored couture fit.
  - `> 0.0`: Enlarges bust contours, fuller silhouette, prominent chest framing.
- **`waist_cinch`** (`FLOAT`): `min: -5.0`, `max: 5.0`, `step: 0.1`, `default: 0.0`, `display: "slider"`
- **`hips_and_butt`** (`FLOAT`): `min: -5.0`, `max: 5.0`, `step: 0.1`, `default: 0.0`, `display: "slider"`
- **`thigh_thickness`** (`FLOAT`): `min: -5.0`, `max: 5.0`, `step: 0.1`, `default: 0.0`, `display: "slider"`
- **`muscle_tone`** (`FLOAT`): `min: -5.0`, `max: 5.0`, `step: 0.1`, `default: 0.0`, `display: "slider"`
- **`age_shift`** (`INT`): `min: -30`, `max: 50`, `step: 1`, `default: 0`, `display: "slider"`
- **`smile_intensity`** (`FLOAT`): `min: 0.0`, `max: 3.0`, `step: 0.1`, `default: 0.0`, `display: "slider"`
- **`skin_glow`** (`FLOAT`): `min: 0.0`, `max: 3.0`, `step: 0.1`, `default: 0.0`, `display: "slider"`
- **`hair_color`** (`COMBO`): `["unchanged", "platinum blonde", "honey blonde", "jet black", "brunette", "auburn", "vibrant red", "pastel pink", "silver gray", "neon blue", "emerald green"]`
- **`eye_color`** (`COMBO`): `["unchanged", "emerald green", "deep sapphire blue", "golden hazel", "warm amber", "chocolate brown", "smoky gray", "violet"]`
- **`ethnicity`** (`COMBO`): `["unchanged", "east asian", "south asian", "nordic european", "mediterranean", "african", "latino hispanic", "middle eastern", "celtic"]`

**Studio UI Recommendation**: Group these into tabs:
1. **Silhouette & Anatomy** (`breasts_scale`, `waist_cinch`, `hips_and_butt`, `thigh_thickness`, `muscle_tone`)
2. **Face & Cosmetics** (`age_shift`, `smile_intensity`, `skin_glow`, `hair_color`, `eye_color`, `ethnicity`)

### B. `ModusFlowStudioDirector`
Controls camera focal lengths, lighting, and cinematic looks:
- **`lens_focal_length`** (`COMBO`): `["35mm Street / Environmental", "50mm Natural Human Vision", "85mm Gold Standard Portrait", "105mm Macro / Extreme Compression", "24mm Dramatic Wide Angle", "Anamorphic Cinema 2.39:1"]`
- **`camera_angle`** (`COMBO`): `["Eye Level Direct", "Low Angle Heroic", "High Angle Delicate", "Dutch Tilt Dynamic", "Close-up Framing", "Full Body Profile"]`
- **`lighting_setup`** (`COMBO`): `["Rembrandt Studio Triangular Key", "Split Shadow Dramatic", "Butterfly / Paramount Glamour", "Golden Hour Warm Volumetric", "Cyberpunk Neon Bi-Color Rim", "Softbox Diffused Clean High-Key", "Moody Film Noir Chiaroscuro"]`
- **`film_stock`** (`COMBO`): `["Digital Ultra-Clean Crisp", "Kodak Portra 400 Warm Fine Grain", "Fujifilm Superia Natural Tones", "Cinestill 800T Tungsten Halation", "Ilford HP5 Plus Black and White"]`

### C. `ModusFlowStylePicker`
Provides 1-click art styles and palette harmonies:
- **`art_movement`** (`COMBO`): `["photorealistic", "cyberpunk_neon", "editorial_vogue", "film_noir", "synthwave_retro", "dark_fantasy", "oil_painting_baroque", "anime_makoto_shinkai", "studio_ghibli", "concept_art_artstation", "ukiyo_e_woodblock", "street_art_graffiti", "watercolor_ethereal", "3d_claymation_pixar"]`
- **`color_harmony`** (`COMBO`): `["none", "warm_golden", "cool_blue_cyan", "neon_cyber_purple-pink", "monochromatic_dramatic", "pastel_soft", "earthy_autumnal"]`
- **`style_strength`** (`FLOAT`): `min: 0.0`, `max: 2.0`, `step: 0.05`, `default: 1.0`, `display: "slider"`

### D. `ModusFlowHiresFix`
High-resolution 2nd-pass upscaler:
- **`upscale_factor`** (`FLOAT`): `min: 1.25`, `max: 4.0`, `step: 0.25`, `default: 1.5`, `display: "slider"`
- **`denoise`** (`FLOAT`): `min: 0.10`, `max: 0.80`, `step: 0.02`, `default: 0.35`, `display: "slider"`
- **`dewax_strength`** (`FLOAT`): `min: 0.0`, `max: 2.0`, `step: 0.1`, `default: 0.5`, `display: "slider"`
- **`sharpen_radius`** (`FLOAT`): `min: 0.5`, `max: 5.0`, `step: 0.5`, `default: 1.5`, `display: "slider"`

### E. `ModusFlowExportCard`
Generates shareable image recipe cards with Civitai PNGInfo compatibility:
- **`card_title`** (`STRING`): Recipe title
- **`author_handle`** (`STRING`): Social media tag (e.g., `@ModusFlowCreator`)
- **`render_recipe_banner`** (`BOOLEAN`): Renders a sleek dark overlay at the base showing prompt, seed, model, and sliders.

---

## 4. Special Spatial Dimension Rules (DiT Patchify)

When ModusFlow Studio generates or alters resolution parameters for **ChromaHD-1** or **Flux.1-dev**:
> [!IMPORTANT]
> **Spatial 16-Pixel Alignment**: Both Flux and Chroma use patchified spatial latent representations (`H // 2, W // 2`). Always ensure width and height sent to KSampler, latents, or crop bounding boxes are divisible by **16** (`(val + 15) // 16 * 16`). ModusFlow nodes enforce this automatically.

---

## 5. Summary for ModusFlow Studio Updates

When updating ModusFlow Studio:
1. Point your node introspector / parser directly at this repository (`modules/*.py` or live ComfyUI `/object_info`).
2. Read slider widgets (`FLOAT`/`INT` with `min`, `max`, `step`, and `"display": "slider"`) and map them directly to native Photino.Blazor slider components.
3. Use the workflows in `workflows/` as reference templates for one-click presets.
