# ModusFlow Face Swapper

Identity transfer, face alignment, and zero-shot photo-to-photo face swapping for ComfyUI.

## Overview

The **ModusFlow Face Swapper** (`ModusFlowFaceSwap`) node transfers facial likeness from a reference portrait image onto any target character image. It features automated face detection (YOLO), scale-adaptive positioning, Reinhard color/lighting transfer, feathered alpha blending, and outputs a full-resolution inpainting mask for seamless integration with diffusion models and the **ModusFlow All-in-One Detailer**.

## Features

- **Reference Photo Swapping**: Swap any face without needing trained LoRAs or pre-computed models.
- **Automated Face Detection**: Scans and uses YOLO face detection models (`face_yolov8n.pt`, etc.) with adjustable confidence.
- **Reinhard Lighting & Color Transfer**: Automatically balances the reference face's skin tones, brightness, and color palette to match the target scene's ambient lighting.
- **Feathered Compositing**: Creates a smooth elliptical alpha gradient for seamless seam-free skin integration.
- **Mask Output for Diffusion Refinement**: Emits a full-frame `face_mask` designed to feed directly into the **ModusFlow All-in-One Detailer** or inpainting sampler for photorealistic skin pore blending, eye reflection matching, and seam disappearance.
- **Aligned Face Preview**: Emits an isolated crop of the transferred face for instant inspection.

## Inputs

| Input | Type | Default | Description |
|---|---|---|---|
| `target_image` | IMAGE | Required | The destination image containing the body/scene to receive the face. |
| `reference_image` | IMAGE | Required | The portrait photo providing the new face identity. |
| `detector_model` | COMBO | `face_yolov8n.pt` | Ultralytics face detection model. |
| `detection_confidence` | FLOAT | `0.45` | Minimum confidence score for face detection (0.10 to 0.99). |
| `target_face_index` | INT | `0` | Index of the face to swap if multiple people are in the target image. |
| `color_match` | COMBO | `reinhard` | Color tone transfer mode (`reinhard` or `none`). |
| `face_scale` | FLOAT | `1.0` | Relative scaling factor for face alignment (0.7 to 1.4). |
| `blend_feather` | INT | `20` | Gaussian blur radius applied to the composite edge mask (2 to 64). |
| `context_padding` | INT | `16` | Context padding around reference crop. |
| `optional_mask` | MASK | Optional | Optional custom mask override. |

## Outputs

| Output | Type | Description |
|---|---|---|
| `image` | IMAGE | The composited image with the swapped face. |
| `face_mask` | MASK | High-precision full-resolution face mask for diffusion inpainting. |
| `aligned_face` | IMAGE | Aligned and color-matched reference face crop. |

## Standard Workflow

```
[Target Image] ───────┐
                      ├──► [ModusFlow Face Swapper] ──► [All-in-One Detailer] ──► [De-Wax] ──► [Compare Images]
[Reference Image] ────┘          │ (face_mask)                ▲
                                 └────────────────────────────┘
```
