# Virtual Studio Director & Style Preset

Professional photography optics, cinematic lighting schemes, and film stock color grading for ComfyUI.

## Overview

The **ModusFlow Virtual Studio Director** (`ModusFlowStudioDirector`) node acts as a virtual Director of Photography (DoP) on your canvas. Instead of having to memorize dozens of specialized photography tokens, users can configure optics, framing, lighting, and film stock color profiles using simple, intuitive dropdowns.

## Features

- **Focal Length & Lens Emulation**:
  - `14mm Ultra-Wide`: Epic panoramic vistas and dynamic perspective distortion.
  - `24mm Wide Angle`: Narrative environmental portraits.
  - `35mm Street`: Classic documentary framing.
  - `50mm Standard`: Natural human eye perception.
  - `85mm Portrait`: Flattering facial compression and creamy background bokeh.
  - `135mm Telephoto`: Intense background isolation and subject compression.
  - `200mm Super-Telephoto`: Ultra-flat perspective and distant subject framing.
  - `Macro Extreme Close-Up`: Microscopic skin, iris, or fabric textures.
- **Cinematic Framing & Angles**: Eye level, low heroic upward angle, high contextual angle, dramatic Dutch tilt, over-the-shoulder, bird's-eye aerial drone view, or worm's-eye floor angle.
- **Studio & Cinematic Lighting**:
  - `Golden Hour`: Warm low-angle sunlight with long dramatic shadows.
  - `Rembrandt Portrait`: Classic moody portrait lighting with the signature triangle cheek highlight.
  - `Cyberpunk Neon`: Dual-tone electric cyan-blue and hot magenta illumination.
  - `Softbox Studio`: Clean, diffused beauty and fashion lighting.
  - `Chiaroscuro Noir`: High-contrast, deep pitch-black shadows.
  - `Volumetric God Rays`: Atmospheric dusty light shafts.
  - `Backlit Rim Light`: Dramatic glowing silhouette halo.
  - `Overcast Soft Light`: Gentle, shadowless, natural skin tones.
- **Film Stocks & Analog Color Grading**:
  - `Kodak Portra 400`: Flattering warm skin tones and soft pastels.
  - `Fujifilm Superia`: Crisp cool greens and punchy magenta undertones.
  - `Cinestill 800T`: Tungsten evening lighting with signature red halation.
  - `Ilford HP5 Plus`: Medium-format fine-art monochrome with rich grain.
  - `Vintage Polaroid 600`: Nostalgic warm fade, soft focus, and gentle vignette.
  - `Kodachrome 64`: Punchy 1970s saturated colors and deep contrast.
  - `Technicolor 3-Strip`: Golden Age Hollywood vintage saturated cinema.
- **Aperture & Depth of Field**: From `f/1.2 ultra-shallow creamy bokeh` to `f/11 deep landscape focus`.

## Inputs & Outputs

| Name | Type | Description |
|---|---|---|
| `focal_length` | COMBO | Camera lens focal length emulation. |
| `camera_angle` | COMBO | Framing and shooting perspective. |
| `lighting` | COMBO | Cinematic and studio lighting setup. |
| `film_stock` | COMBO | Analog film stock and color grading curve. |
| `aperture` | COMBO | Depth of field and bokeh intensity. |
| `atmosphere` | COMBO | Environmental effects (dust, fog, rain reflections, lens flares). |
| `effect_strength` | FLOAT | Weight multiplier (0.0 to 2.0). |

Outputs include `positive_tags`, `negative_tags`, `full_prompt`, and `pipe`.
