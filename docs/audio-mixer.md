# ModusFlow Audio Mixer & Video Sync

Production-grade audio mixing and video synchronization node. Blends sound effects / Foley tracks (from MMAudio) with musical soundtracks (from DiffRhythm / Stable Audio) into a unified stereo audio stream.

## Overview
- **Dual-Track Mixing**: Seamlessly blends two independent audio inputs (e.g. video sound effects + background score).
- **Independent Volume Control**: Individual volume scaling for Track 1 and Track 2 (0.0× to 3.0×).
- **Automatic Resampling**: Harmonizes differing sample rates (e.g. 44.1 kHz vs 48 kHz) with high-fidelity torchaudio resampling.
- **Length Synchronization**: Trims or pads audio tracks to match target video lengths.
- **Peak Normalization**: Prevents audio clipping or digital distortion if combined signals exceed 0 dBFS.

## Inputs

### Required
- **track1_volume** (FLOAT, default: 1.0): Gain multiplier for Track 1 (usually Foley / Sound Effects).
- **track2_volume** (FLOAT, default: 0.8): Gain multiplier for Track 2 (usually Background Music).
- **target_duration** (FLOAT, default: 0.0): Desired duration in seconds (`0.0` automatically matches the longest input track). Can be connected directly from the `duration` output of **ModusFlow Video Latent Preset** to automatically conform audio length to the video.
- **normalize_output** (BOOLEAN, default: true): Prevents digital clipping when tracks sum above peak threshold.

### Optional
- **track1_sfx** (AUDIO): First audio input dictionary `{"waveform": tensor, "sample_rate": int}`.
- **track2_music** (AUDIO): Second audio input dictionary.

## Outputs
- **audio** (AUDIO): Unified, mixed stereo audio stream ready for `ModusFlowSaveVideo` or `ModusFlowSaveAudio`.
- **duration** (FLOAT): Total duration of the resulting mixed audio track in seconds.
