# Pony Diffusion V6 XL: Face & Quality Mastery Guide

A comprehensive guide to getting clean, sharp, distortion-free faces, eyes, and anatomy in Pony Diffusion V6 XL workflows using ModusFlow.

---

## 1. The Core Secret: AstraliteHeart's Score Bucket System

Pony V6 is an SDXL architecture fine-tuned on millions of images categorized with an automated aesthetic scoring system. **Without the mandatory score tags, the text encoder defaults to uncurated, low-quality training data**, leading to derpy eyes, melted facial features, and blurry linework.

### Positive Header (Place at the Very Beginning of Prompt)
```
score_9, score_8_up, score_7_up, source_anime, rating_safe,
```
* **Rating tags**:
  * `rating_safe` (SFW)
  * `rating_questionable` (Ecchi / suggestive)
  * `rating_explicit` (NSFW)

### Negative Header (Place at the Very Beginning of Negative)
```
score_4, score_5, score_6, source_pony, source_furry, ugly, deformed, bad eyes, bad anatomy, bad hands, blurry
```

> [!IMPORTANT]
> **Why `source_pony, source_furry` in negative?**
> Pony was trained on both human anime and MLP/furry datasets. Adding `source_pony, source_furry` to your negative prompt is the secret to forcing human facial geometry, preventing equine muzzles and weird furry head proportions.

---

## 2. CLIP Skip Must Be Set to `-2`

Pony was specifically trained with **CLIP Skip -2** (skipping the last layer of the CLIP text encoder).
* In **`ModusFlow Model Loader`**, set **`clip_skip`** to **`-2`** (not `-1`).
* **Symptom if wrong:** Blurry irises, double pupils, messy line art, and stiff, plastic-looking skin.

---

## 3. Tagging Syntax: Danbooru Tags vs. Prose

Pony's text encoder understands Danbooru comma-separated tags, **not** long natural language paragraphs.

* ❌ **Avoid Prose:**
  > *"A stunning young woman looking directly into the camera with sparkling blue eyes and glowing skin in high detail."*
* ✅ **Use Structured Tags:**
  > `1girl, solo, portrait, beautiful detailed face, blue eyes, expressive eyes, catchlight, detailed pupils, gentle smile, parted lips, looking at viewer, long silver hair`

### High-Impact Facial Feature Tags
| Category | Recommended Tags |
|---|---|
| **Eyes** | `detailed eyes`, `beautiful eyes`, `expressive eyes`, `catchlight`, `detailed pupils`, `eyelashes` |
| **Gaze** | `looking at viewer`, `looking back`, `side glance`, `eye contact` |
| **Mouth** | `gentle smile`, `parted lips`, `slight smile`, `closed mouth`, `open mouth` |
| **Skin & Face** | `detailed face`, `blush`, `soft skin`, `cheek blush` |

---

## 4. Sampling & Guidance Settings

Pony is prone to "guidance burn" if CFG is too high:

| Setting | Recommended Value | Notes |
|---|---|---|
| **Sampler** | `euler_ancestral` (`euler_a`) or `dpmpp_2m_sde_gpu` | `euler_ancestral` produces the softest, most natural anime facial shading. |
| **Scheduler** | `karras` or `normal` | `karras` yields crisp eye highlights and cleaner hair strands. |
| **Steps** | `26 – 32` | Don't exceed 35 steps; excessive steps cause over-sharpened, rigid line art. |
| **CFG Scale** | `5.5 – 6.8` | Never run above `7.5`. High CFG burns eye pupils into black voids. |

### Dynamic Guidance with ModusFlow
In **`ModusDynamicGuidance`**:
* **Mode**: `CFG Scale (Chroma / SDXL / SD1.5)`
* **`scale_start`**: `6.5`
* **`scale_end`**: `3.5`
* **Profile**: `linear`
* *Why it works:* High initial CFG anchors the composition and facial geometry, while decaying CFG near the end prevents eye and skin burning.

---

## 5. Solving the "Small Face" Problem (Detailer Pass)

At $1024 \times 1024$ base resolution, in **full-body** or **wide-angle** generations, the character's face may only occupy $64 \times 64$ to $96 \times 96$ pixels. No base diffusion model can render delicate eyelashes, catchlights, and irises in that small of an area.

Use **`ModusFlow All-in-One Detailer`** with dedicated slots:

### Slot 1: Face (`ModusFlow Detailer Slot - Face`)
* **Detector**: `face-yolo8n.pt`
* **Denoise**: `0.30 – 0.35`
* **Steps**: `20`
* **Sampler / Scheduler**: `euler_ancestral` / `karras`
* **Positive Prompt**: `score_9, score_8_up, detailed face, beautiful face, smooth skin`

### Slot 2: Eyes (`ModusFlow Detailer Slot - Eyes`)
* **Detector**: `PitEyeDetailer-v2-seg.pt`
* **Denoise**: `0.25 – 0.30`
* **Steps**: `20`
* **Positive Prompt**: `detailed eyes, detailed pupils, catchlight, sharp focus`

---

## 6. Eliminating Plastic / Waxy Skin

If faces appear unnaturally shiny or like a plastic doll:
1. Run the image through **`Modus De-Wax Texture Restore`**:
   * **`blend_mode`**: `soft_light`
   * **`blend_strength`**: `0.15`
   * **`detail_boost`**: `0.10`
2. Add **`ModusFlow Restormer`** at `blend: 0.20 – 0.30` to recover organic skin pores and film grain.

---

## 7. Quick Troubleshooting Checklist

| Problem | Cause | Solution |
|---|---|---|
| **Facial features are malformed or derpy** | Missing score tags | Start positive with `score_9, score_8_up, score_7_up, source_anime,` |
| **Eyes look like black holes or burned** | CFG is too high (>7.5) | Lower CFG to `5.5 – 6.5` or use `ModusDynamicGuidance` decay. |
| **Double pupils or blurry irises** | CLIP skip is `-1` | Set `clip_skip: -2` in `ModusFlow Model Loader`. |
| **Face looks horse-like or furry** | Pony concept bleed | Add `source_pony, source_furry` to negative prompt. |
| **Face in full-body shot has no detail** | Small pixel area (<96px) | Enable `ModusFlowDetailerSlot` for Face and Eyes. |
| **Skin looks like melted plastic** | Over-smoothed VAE/denoise | Pipe through `Modus De-Wax Texture Restore` (`blend_strength: 0.15`). |
