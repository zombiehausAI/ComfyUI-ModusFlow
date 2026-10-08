# Glamour & Body Sculpting Studio

Multi-zone character styling, facial transformation, and anatomical silhouette sculpting with ModusFlow.

## Overview

The **Glamour & Body Sculpting Studio** workflow (`workflows/Glamour and Body Sculpting Studio (ModusFlow).json`) is an all-in-one pipeline for non-destructive photo retouching and character remodeling. Using multi-slot targeted detection and inpainting passes orchestrated by the **ModusFlow All-in-One Detailer**, you can transform:

- **Facial Features**: Age (younger/older), ethnicity, makeup, eye color, and smile.
- **Hair & Complexion**: Hairstyle, hair color, skin tone, and bronzing.
- **Silhouette & Physique**: Upper torso / chest toning, waist-to-hip ratio, thighs, and athletic definition.
- **Hands & Nails**: Cleaning extra fingers, posing, and manicures.
- **Skin Pores & Fabric Drape**: Preserving natural pores and clothing textures via **Modus De-Wax**.

---

## Multi-Slot Architecture

```
[Original Photo] ──► [ModusFlow All-in-One Detailer] ──► [Modus De-Wax] ──► [A/B Compare]
                           ▲   ▲   ▲   ▲   ▲
                           │   │   │   │   └── Slot 5: Hands & Nails (denoise: 0.55)
                           │   │   │   └────── Slot 4: Waist, Hips & Curves (denoise: 0.68, context_pad: 48)
                           │   │   └────────── Slot 3: Upper Torso & Chest (denoise: 0.65, context_pad: 40)
                           │   └────────────── Slot 2: Eyes & Iris Color (denoise: 0.36)
                           └────────────────── Slot 1: Face, Age, Ethnicity & Makeup (denoise: 0.52)
```

---

## Recommended Settings & Denoise Matrix

| Zone / Feature | Recommended Denoise | Context Pad | Blend Feather | Suggested Prompting Strategy |
|---|---|---|---|---|
| **Eye Color & Reflections** | `0.32–0.38` | `24px` | `16px` | `"striking sapphire-blue iris, detailed pupil, natural catchlights"` |
| **Makeup & Smile** | `0.40–0.48` | `28px` | `20px` | `"velvet rose-pink matte lipstick, warm subtle smile, winged eyeliner"` |
| **Age Shift (Younger/Older)**| `0.45–0.54` | `32px` | `24px` | `"youthful radiant 20yo complexion"` OR `"distinguished 50yo, subtle laugh lines, mature elegance"` |
| **Ethnicity Shift** | `0.55–0.65` | `32px` | `24px` | Specify ethnic facial bone structure, eye shape, and skin undertones while keeping head tilt and lighting. |
| **Upper Torso / Chest / Pecs**| `0.60–0.70` | `40px` | `28px` | Include garment fit: `"athletic broad chest, sculpted pectoral contours, fitted crisp shirt"` |
| **Waist / Hips / Thighs** | `0.65–0.75` | `48px` | `32px` | `"slender cinched waistline, curvaceous feminine hips, fitted stretch denim, realistic fabric tension"` |
| **Hands & Manicure** | `0.52–0.60` | `32px` | `20px` | `"perfect 5 fingers, graceful hands, polished glossy red almond nails"` |

---

## ModusFlow Glamour & Body Sculpt Controller Node

The `ModusFlowGlamourController` node provides direct visual sliders and dropdowns on the canvas, dynamically generating prompt tokens and calculating optimal inpainting denoise values without requiring manual prompt engineering:

### Sliders & Controls

| Control | Type | Range | Description |
|---|---|---|---|
| **`breasts_scale`** | FLOAT Slider | `-5.0` to `+5.0` | **Enlarge or reduce bust size**: negative values yield a petite/slender bust; positive values enlarge and enhance curves with natural garment tension. |
| **`waist_cinch`** | FLOAT Slider | `-5.0` to `+5.0` | **Waistline sculpting**: negative values cinch the waist into an hourglass curve; positive values create a relaxed/straight torso fit. |
| **`hips_and_butt`** | FLOAT Slider | `-5.0` to `+5.0` | **Lower body curves**: negative values slim the hips; positive values widen hips and shape glutes. |
| **`thigh_thickness`** | FLOAT Slider | `-5.0` to `+5.0` | **Leg volume**: negative values slim legs; positive values add athletic/full thigh volume. |
| **`muscle_tone`** | FLOAT Slider | `0.0` to `5.0` | **Athletic definition**: adds sculpted abdominal contouring, toned arms, and pectoral definition. |
| **`age_shift`** | FLOAT Slider | `-5.0` to `+5.0` | **Age alteration**: negative values produce youthful 20s/teen complexion; positive values add distinguished maturity. |
| **`smile_intensity`** | FLOAT Slider | `0.0` to `1.0` | Controls expression from subtle warmth to a full joyful smile. |
| **`skin_glow`** | FLOAT Slider | `0.0` to `1.0` | Adds radiant, dewy subsurface scattering and luminosity. |
| **`hair_color`** | COMBO Dropdown | 10 colors | Platinum blonde, golden blonde, brunette, raven black, auburn, pastel pink, emerald, sapphire, etc. |
| **`eye_color`** | COMBO Dropdown | 7 colors | Ice blue, emerald green, warm hazel, dark brown, amber gold, violet. |
| **`ethnicity`** | COMBO Dropdown | 8 options | Caucasian, East Asian, South Asian, Black/African, Latina, Middle Eastern, Nordic, or Keep Original. |

---

## Technical Tips

### 1. Expanding or Slimming Silhouettes (`context_pad`)
When changing body dimensions (e.g. widening hips or broadening shoulders), the target geometry extends beyond the original detected bounding box.
- Standard face detailing uses `context_pad: 16–32px`.
- Body silhouette changes require `context_pad: 40–48px` and `blend_feather: 28–32px`. This gives the diffusion model room to draw the new silhouette naturally against the surrounding background without clipping seams.

### 2. Clothing Interaction
When modifying body proportions, always mention the clothing in the prompt. Prompting for clothing folds, tension lines, and fabric textures ensures the garment stretches or tailors realistically over the new curves.

### 3. Preserving Real Skin Texture
AI inpainting can sometimes leave skin looking overly smooth or airbrushed. The pipeline terminates with **Modus De-Wax Texture Restore**, which:
- Separates high-frequency skin pores from mid-tone colors.
- Amplifies natural micro-pores (`micro_texture: 0.25–0.30`).
- Blends organic sensor grain (`grain_intensity: 0.05–0.08`) into mid-tones so the transformed image looks like a high-end photograph.

