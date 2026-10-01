"""
ModusFlow Audio Mixer & Video Sync Node

Blends sound effects / foley (from MMAudio) with music tracks (from DiffRhythm / Stable Audio)
into a single production-grade stereo audio stream for ModusFlow Save Video.
Features independent volume levels, audio resampling, length matching, and music ducking.
"""

import torch
import math

class ModusFlowAudioMixer:
    """
    Mixes two audio tracks (e.g. Foley/SFX from MMAudio + Background Music from DiffRhythm)
    into a single unified stereo AUDIO stream for video muxing or audio saving.
    """

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "track1_volume": ("FLOAT", {"default": 1.0, "min": 0.0, "max": 3.0, "step": 0.05, "tooltip": "Volume level for Track 1 (usually Foley/SFX)"}),
                "track2_volume": ("FLOAT", {"default": 0.8, "min": 0.0, "max": 3.0, "step": 0.05, "tooltip": "Volume level for Track 2 (usually Background Music)"}),
                "target_duration": ("FLOAT", {"default": 0.0, "min": 0.0, "max": 3600.0, "step": 0.1, "tooltip": "Optional target duration in seconds (0 = auto match longest track)"}),
                "normalize_output": ("BOOLEAN", {"default": True, "tooltip": "Prevent audio clipping by normalizing peaks if volume exceeds 1.0"}),
            },
            "optional": {
                "track1_sfx": ("AUDIO",),
                "track2_music": ("AUDIO",),
            },
        }

    RETURN_TYPES = ("AUDIO", "FLOAT",)
    RETURN_NAMES = ("audio", "duration",)
    FUNCTION = "mix_audio"
    CATEGORY = "ModusFlow/Audio"

    def mix_audio(self, track1_volume, track2_volume, target_duration, normalize_output,
                  track1_sfx=None, track2_music=None):
        if track1_sfx is None and track2_music is None:
            # Return 1 second of silence at 44.1kHz
            silence = torch.zeros((1, 2, 44100), dtype=torch.float32)
            return ({"waveform": silence, "sample_rate": 44100}, 0.0)

        # Handle single track passthrough with volume adjustment
        if track1_sfx is not None and track2_music is None:
            sr = track1_sfx.get("sample_rate", 44100)
            wf = track1_sfx["waveform"].clone() * track1_volume
            if normalize_output and wf.abs().max() > 1.0:
                wf = wf / wf.abs().max()
            duration = wf.shape[-1] / float(sr)
            return ({"waveform": wf, "sample_rate": sr}, duration)

        if track2_music is not None and track1_sfx is None:
            sr = track2_music.get("sample_rate", 44100)
            wf = track2_music["waveform"].clone() * track2_volume
            if normalize_output and wf.abs().max() > 1.0:
                wf = wf / wf.abs().max()
            duration = wf.shape[-1] / float(sr)
            return ({"waveform": wf, "sample_rate": sr}, duration)

        # Both tracks present: resample to primary sample rate (Track 1)
        sr1 = track1_sfx.get("sample_rate", 44100)
        sr2 = track2_music.get("sample_rate", 44100)
        wf1 = track1_sfx["waveform"].clone()
        wf2 = track2_music["waveform"].clone()

        # Ensure 3D shape [B, C, T]
        if wf1.dim() == 2:
            wf1 = wf1.unsqueeze(0)
        if wf2.dim() == 2:
            wf2 = wf2.unsqueeze(0)

        # Ensure stereo (2 channels)
        if wf1.shape[1] == 1:
            wf1 = wf1.repeat(1, 2, 1)
        if wf2.shape[1] == 1:
            wf2 = wf2.repeat(1, 2, 1)

        target_sr = sr1
        if sr1 != sr2:
            try:
                import torchaudio.transforms as T
                resampler = T.Resample(orig_freq=sr2, new_freq=target_sr).to(wf2.device)
                wf2 = resampler(wf2)
            except Exception:
                # Linear interpolation fallback
                new_len = int(wf2.shape[-1] * (target_sr / float(sr2)))
                wf2 = torch.nn.functional.interpolate(wf2, size=new_len, mode="linear", align_corners=False)

        # Scale volumes
        wf1 = wf1 * track1_volume
        wf2 = wf2 * track2_volume

        # Match lengths
        len1 = wf1.shape[-1]
        len2 = wf2.shape[-1]

        if target_duration > 0.0:
            target_samples = int(target_duration * target_sr)
        else:
            target_samples = max(len1, len2)

        # Pad or trim track 1
        if wf1.shape[-1] < target_samples:
            wf1 = torch.nn.functional.pad(wf1, (0, target_samples - wf1.shape[-1]))
        else:
            wf1 = wf1[:, :, :target_samples]

        # Pad or trim track 2
        if wf2.shape[-1] < target_samples:
            wf2 = torch.nn.functional.pad(wf2, (0, target_samples - wf2.shape[-1]))
        else:
            wf2 = wf2[:, :, :target_samples]

        # Mix tracks
        mixed = wf1.to(wf2.device) + wf2

        # Normalize peaks to prevent distortion
        if normalize_output:
            max_val = mixed.abs().max()
            if max_val > 1.0:
                mixed = mixed / max_val * 0.98

        final_duration = mixed.shape[-1] / float(target_sr)
        print(f"[ModusFlow AudioMixer] Mixed 2 audio tracks -> {final_duration:.2f}s @ {target_sr}Hz (peak: {mixed.abs().max():.2f})")

        return ({"waveform": mixed, "sample_rate": target_sr}, final_duration)


NODE_CLASS_MAPPINGS = {
    "ModusFlowAudioMixer": ModusFlowAudioMixer
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "ModusFlowAudioMixer": "ModusFlow Audio Mixer & Video Sync"
}
