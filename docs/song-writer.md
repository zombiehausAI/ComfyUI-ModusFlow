# ModusFlow Song Writer & Lyric Studio

Interactive song composition and lyric formatting node tailored for state-of-the-art vocal music generation models (such as DiffRhythm and YuE).

## Overview
- **Structured Lyric Architecture**: Formats lyrics with industry-standard tags (`[intro]`, `[verse]`, `[pre-chorus]`, `[chorus]`, `[bridge]`, `[outro]`) recognized by AI vocal generation models.
- **Curated Musical Genres**: Includes presets for Indie Folk, 80s Synthwave, Cinematic Epic Rock, Pop Dance, Melodic Metal, Cyberpunk Industrial, and more.
- **Vocal Performance Styling**: Detailed vocal timbre options including female belted, warm acoustic lead, male raspy baritone, harmonies, and whispered styles.
- **Built-in Song Templates**: Instant access to complete, formatted lyric templates for rapid track drafting.
- **Metadata Passthrough**: Passes song title cleanly to `ModusFlowSaveAudio` for `%title%` filename variable substitution and ID3 tagging.

## Inputs

### Required
- **title** (STRING): The song title. Used as the track name and filename substitution variable.
- **genre** (dropdown): Musical style descriptor (instruments, genre conventions, tempo atmosphere).
- **vocal_style** (dropdown): Timbre, vocal range, and performance style (e.g. `Female vocal, emotional, expressive, clear tone`).
- **mood** (dropdown): Emotional resonance and energy level.
- **template** (dropdown): Ready-made structured lyric templates (`Standard Pop/Rock`, `Acoustic Ballad / Folk`, `Cinematic Epic / Rock`, `Synthwave / Cyberpunk`, `Custom`).
- **lyrics** (STRING, multiline): The full song lyrics including section tags.

### Optional
- **additional_style** (STRING): Custom descriptors to append (e.g. `reverb, 120 bpm, acoustic bass, minor scale`).
- **negative_style** (STRING): Undesired sonic traits (e.g. `harsh noise, clipping, distorted vocals, robotic glitch`).

## Outputs
- **style_prompt** (STRING): Cohesive musical and vocal prompt ready for DiffRhythm or YuE.
- **lyrics** (STRING): Clean, formatted lyrics with section markers.
- **title** (STRING): Song title for saving and metadata.
- **negative_style** (STRING): Negative conditioning string.
