# Social Export Card & Metadata Burner

Clean metadata publishing, Civitai generation recipes, watermarks, and recipe ribbons.

## Overview

The **ModusFlow Social Export Card** (`ModusFlowExportCard`) prepares your generations for public sharing on Reddit, Discord, and Civitai:

1. **Prompt Sanitization**: Automatically strips internal `<lora:...>` syntax tags and excessive commas so the public prompt is clean and readable.
2. **Civitai-Compliant PNGInfo**: Embeds generation metadata, seed, model, and sampler settings directly into the PNG file.
3. **Artist Watermark / Signature**: Adds an optional subtle, semi-transparent watermark in any corner (`bottom_right`, `bottom_left`, `top_right`, `top_left`).
4. **Recipe Banner**: Optionally burns a clean, dark footer ribbon with model name, seed, and sampler details.

## Inputs & Controls

| Parameter | Type | Default | Description |
|---|---|---|---|
| `images` | IMAGE | Required | Image batch to export and save. |
| `filename_prefix`| STRING | `ModusFlow` | Output file prefix. |
| `clean_metadata` | BOOLEAN| `True` | Strips internal syntax tags from embedded prompt text. |
| `watermark_text` | STRING | `""` | Optional artist name or handle. |
| `watermark_position`| COMBO | `bottom_right`| Corner placement for signature. |
| `watermark_opacity` | FLOAT | `0.65` | Transparency of watermark text (0.1 to 1.0). |
| `burn_recipe_banner`| BOOLEAN| `False` | Renders a dark aesthetic stats banner across the bottom. |
| `prompt_text` | STRING | Optional | Positive prompt text to embed. |
| `model_name` | STRING | Optional | Base checkpoint name for banner display. |
| `seed` | INT | Optional | Seed number for metadata. |

Outputs `exported_image` and `clean_prompt`.
