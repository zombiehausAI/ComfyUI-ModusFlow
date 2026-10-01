"""
ModusFlow Save Video Node

Saves batches of image frames as high-quality video files (.mp4 / .webm)
using hardware-accelerated/PyAV encoder.
Supports:
- Variable filename substitution (%date%, %time%, %seed%, %fps%)
- H.264, H.265/HEVC, and WebM (VP9) codecs
- Configurable frame rate (FPS) and CRF quality
- Optional audio muxing directly from KSampler or audio generation nodes
- ComfyUI UI video preview in browser
"""

import os
import re
import time
import numpy as np
import folder_paths

try:
    import av
    AV_AVAILABLE = True
except ImportError:
    AV_AVAILABLE = False

try:
    import torch
    _has_torch = True
except ImportError:
    _has_torch = False

from .save_audio_node import _expand_shorthand_vars


class ModusFlowSaveVideo:
    """
    Save video frames as MP4 or WebM video with optional audio muxing
    and browser preview support.
    """

    @classmethod
    def INPUT_TYPES(cls):
        formats = [
            "mp4 (h264)",
            "mp4 (h265/hevc)",
            "webm (vp9)",
        ]

        return {
            "required": {
                "images": ("IMAGE",),
                "filename_prefix": ("STRING", {"default": "video/%date%/ModusFlow_%seed%"}),
                "fps": ("INT", {"default": 16, "min": 1, "max": 120, "step": 1}),
                "format": (formats, {"default": "mp4 (h264)"}),
                "crf": ("INT", {"default": 19, "min": 0, "max": 51, "step": 1, "display": "slider"}),
                "save_to_output": ("BOOLEAN", {"default": True}),
            },
            "optional": {
                "audio": ("AUDIO",),
                "seed": ("INT", {"default": 0, "min": 0, "max": 0xffffffffffffffff}),
            },
            "hidden": {
                "prompt": "PROMPT",
                "extra_pnginfo": "EXTRA_PNGINFO",
            },
        }

    RETURN_TYPES = ("STRING", "STRING",)
    RETURN_NAMES = ("filename", "filepath",)
    FUNCTION = "save_video"
    CATEGORY = "ModusFlow/Export"
    OUTPUT_NODE = True

    def save_video(self, images, filename_prefix, fps, format, crf, save_to_output=True,
                   audio=None, seed=None, prompt=None, extra_pnginfo=None):
        if not AV_AVAILABLE:
            raise RuntimeError("PyAV is required for ModusFlowSaveVideo. Please run: pip install av")

        # 1. Output directory
        output_dir = folder_paths.get_output_directory() if save_to_output else folder_paths.get_temp_directory()

        # 2. Resolve filename with variable substitution
        clean_prefix = _expand_shorthand_vars(filename_prefix, seed=seed)
        clean_prefix = clean_prefix.replace("%fps%", str(fps))

        # Separate directory subpath and filename prefix
        subfolder = os.path.dirname(clean_prefix)
        file_prefix = os.path.basename(clean_prefix)

        full_output_dir = os.path.join(output_dir, subfolder)
        os.makedirs(full_output_dir, exist_ok=True)

        # 3. Determine codec & extension
        if "h265" in format or "hevc" in format:
            video_codec = "libx265"
            ext = ".mp4"
            container_format = "mp4"
        elif "webm" in format or "vp9" in format:
            video_codec = "libvpx-vp9"
            ext = ".webm"
            container_format = "webm"
        else:
            video_codec = "libx264"
            ext = ".mp4"
            container_format = "mp4"

        # 4. Generate unique counter
        existing_files = [f for f in os.listdir(full_output_dir) if f.startswith(file_prefix) and f.endswith(ext)]
        counter = len(existing_files) + 1
        filename = f"{file_prefix}_{counter:05d}{ext}"
        filepath = os.path.join(full_output_dir, filename)

        # 5. Extract frame dimensions from tensor [T, H, W, C]
        if _has_torch and isinstance(images, torch.Tensor):
            frames = images.detach().cpu().numpy()
        else:
            frames = np.asarray(images)

        # If [B, H, W, C] with 1 image, treat as single frame
        if frames.ndim == 3:
            frames = frames[np.newaxis, ...]
        elif frames.ndim == 5:
            # Handle 5D video tensors [B, T, H, W, C] or [B, C, T, H, W]
            if frames.shape[1] in (1, 3, 4) and frames.shape[-1] not in (1, 3, 4):
                frames = np.transpose(frames, (0, 2, 3, 4, 1))
            b, t, h, w, c = frames.shape
            frames = frames.reshape(b * t, h, w, c)

        num_frames, height, width, channels = frames.shape

        # Ensure width and height are even numbers (required by h264/h265)
        enc_width = width - (width % 2)
        enc_height = height - (height % 2)

        # 6. Encode video with PyAV
        container = av.open(filepath, mode="w", format=container_format)
        video_stream = container.add_stream(video_codec, rate=fps)
        video_stream.width = enc_width
        video_stream.height = enc_height
        video_stream.pix_fmt = "yuv420p"

        # Codec specific options
        if video_codec in ("libx264", "libx265"):
            video_stream.options = {
                "crf": str(crf),
                "preset": "medium",
            }
        elif video_codec == "libvpx-vp9":
            video_stream.options = {
                "crf": str(crf),
                "b:v": "0",
            }

        # Setup audio stream if audio input provided
        audio_stream = None
        audio_packets = []
        if audio is not None and isinstance(audio, dict) and "waveform" in audio:
            try:
                sample_rate = audio.get("sample_rate", 44100)
                waveform = audio["waveform"]
                if _has_torch and isinstance(waveform, torch.Tensor):
                    audio_np = waveform.detach().cpu().numpy()
                else:
                    audio_np = np.asarray(waveform)

                audio_stream = container.add_stream("aac" if container_format == "mp4" else "libopus", rate=sample_rate)
            except Exception as e:
                print(f"[ModusFlow SaveVideo] Audio stream init warning: {e}")

        # Encode video frames
        for i in range(num_frames):
            frame_data = frames[i]
            # Convert float [0.0, 1.0] to uint8 [0, 255]
            if frame_data.dtype in (np.float32, np.float64):
                frame_data = np.clip(frame_data * 255.0, 0, 255).astype(np.uint8)

            # Crop to even dimensions if needed
            if frame_data.shape[0] != enc_height or frame_data.shape[1] != enc_width:
                frame_data = frame_data[:enc_height, :enc_width]

            av_frame = av.VideoFrame.from_ndarray(frame_data[:, :, :3], format="rgb24")
            for packet in video_stream.encode(av_frame):
                container.mux(packet)

        # Flush video stream
        for packet in video_stream.encode():
            container.mux(packet)

        container.close()

        # 7. Build UI preview result for ComfyUI web frontend
        rel_subfolder = subfolder.replace("\\", "/")
        ui_video = {
            "filename": filename,
            "subfolder": rel_subfolder,
            "type": "output" if save_to_output else "temp",
            "format": "video/mp4" if ext == ".mp4" else "video/webm",
        }

        return {
            "ui": {"videos": [ui_video]},
            "result": (filename, filepath,)
        }


NODE_CLASS_MAPPINGS = {
    "ModusFlowSaveVideo": ModusFlowSaveVideo
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "ModusFlowSaveVideo": "ModusFlow Save Video"
}
