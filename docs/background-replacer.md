# Background Replacer & Relighter

Automated foreground segmentation, environmental relighting, and seamless backdrop replacement.

## Overview

The **ModusFlow Background Replacer** (`ModusFlowBackgroundReplacer`) node makes changing backdrops effortless. It automatically segments the foreground subject using YOLO, inverts the mask to isolate the background, and applies ambient edge relighting so the subject naturally fits into their new environment without looking "pasted on."

## Features

- **Automated Person Segmentation**: Uses YOLO segmentation models (`yolov8x-seg.pt`, etc.) with adjustable confidence.
- **Inverted Mask Generation**: Emits an inverted `background_mask` tailored specifically for inpainting nodes.
- **Grow/Shrink & Gaussian Feathering**: Eliminates harsh cutout borders and pixel halos.
- **Ambient Rim Relighting**: Samples the dominant color temperature and luminosity of the new background and casts realistic color bounce onto the subject's edges.
- **Dual Pipeline Support**:
  1. *Direct Backdrop Replacement*: Provide a new photo/render via `new_background_image` for immediate relit compositing.
  2. *Generative Inpainting*: Leave `new_background_image` empty and route the `background_mask` into the **All-in-One Detailer** or KSampler to synthesize new environments from text prompts.

## Inputs & Outputs

| Name | Type | Description |
|---|---|---|
| `image` | IMAGE | Foreground image containing the subject. |
| `detector_model` | COMBO | Ultralytics segmentation model (`yolov8x-seg.pt`). |
| `detection_confidence` | FLOAT | Detection threshold (`0.10` to `0.95`). |
| `grow_shrink` | INT | Mask dilation/erosion (`-64` to `+64` px). |
| `edge_feather` | INT | Soft Gaussian blur radius (`0` to `64` px). |
| `relighting_mode` | COMBO | `ambient_rim` or `none`. |
| `relighting_strength` | FLOAT | Intensity of color bounce on subject edges (`0.0` to `1.0`). |
| `new_background_image` | IMAGE | Optional background photo to composite directly onto. |

### Outputs
- `composite_image`: The relit, composited result.
- `background_mask`: High-precision mask isolating the background.
- `person_mask`: Clean mask of the foreground subject.
- `subject_cutout`: Isolated subject cutout.
