# ModusFlow Save Video

Save generated video tensors to high-quality `.mp4` or `.webm` files with native PyAV encoding, configurable frame rates, bitrate/crf controls, audio muxing, and interactive HTML5 video preview in ComfyUI.

## Overview
- **Self-Contained Encoding**: Uses PyAV (`av`) bindings directly with bundled FFmpeg libraries—no separate system `ffmpeg.exe` installation required.
- **H.264, H.265 (HEVC), & VP9**: Modern video codecs with tuned presets (`fast`, `medium`, `slow`, `veryfast`).
- **Audio Muxing**: Automatically pairs audio tracks (e.g. from AceStep or sound effects nodes) directly into the generated video container with AAC/Opus encoding.
- **Filename Variables**: Full datetime, seed, and resolution variable substitution (`%date%`, `%time%`, `%seed%`, `%fps%`, etc.).
- **Interactive UI Preview**: Emits standard ComfyUI video UI payloads allowing immediate playback in the browser.

## Inputs

### Required
- **images** (IMAGE): Video frames tensor shaped `[batch, height, width, 3]` (standard ComfyUI VAE decode output for videos).
- **filename_prefix** (STRING, default: `videos/%date%/ModusFlow_%seed%`): File destination path and naming pattern. Supports variable interpolation.
- **fps** (FLOAT, default: 16.0): Frame rate of the video. Wan 2.1 typically uses 16.0 fps (or 24.0 fps).
- **format** (dropdown):
  - `mp4 (H.264 / AAC)`: Maximum compatibility across all players and browsers.
  - `mp4 (H.265 / HEVC)`: Modern high-efficiency compression.
  - `webm (VP9 / Opus)`: Open-source web standard container.
- **crf** (INT 0–51, default: 19): Constant Rate Factor. Lower values mean higher visual quality (18–22 is visually lossless; 0 is lossless).
- **preset** (dropdown):
  - `fast` (Default)
  - `medium`
  - `slow`
  - `veryfast`

### Optional
- **audio** (AUDIO): Optional audio dictionary `{"waveform": tensor, "sample_rate": int}` to mux into the video file.
- **seed** (INT): Seed value for `%seed%` filename variable substitution.
- **clean_vram** (BOOLEAN, default: false): Clears PyTorch CUDA memory cache after rendering to free VRAM.

## Output
Output node — no data outputs. The rendered video is saved to your ComfyUI output directory and played in the canvas node preview.

## Supported Filename Variables
- `%date%`: `YYYY-MM-DD`
- `%time%`: `HH-MM-SS`
- `%datetime%`: `YYYY-MM-DD_HH-MM-SS`
- `%seed%`: Seed integer passed to the node.
- `%fps%`: Video frame rate (e.g. `16`).
- `%width%`, `%height%`: Frame resolution dimensions.
- `%year%`, `%month%`, `%day%`, `%hour%`, `%minute%`, `%second%`.
