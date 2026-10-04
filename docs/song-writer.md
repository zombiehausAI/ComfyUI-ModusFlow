# ModusFlow Song Writer & Lyric Studio

Interactive song composition and AI-powered lyric studio tailored for state-of-the-art vocal music generation models (such as ACE-Step, DiffRhythm, and YuE).

## Overview
- **AI-Powered Lyric Studio**: Propose new songs from thematic prompts or refine existing lyrics with local Ollama, Ollama Cloud, or OpenAI-compatible cloud models (OpenRouter, Groq, DeepSeek, OpenAI).
- **Zero-Dependency Web Search**: When enabled, performs live DuckDuckGo web research on the prompt subject to ground song lyrics in real-world lore, historical facts, and authentic details.
- **Editable Song Structure Guide**: Define exact section requirements (`[intro]`, `[verse 1]`, `[pre-chorus]`, `[chorus]`, `[bridge]`, `[outro]`) and musical cues in parentheses `(guitar solo)`.
- **Toggleable Operation**: Switch between `disabled` (instant manual/template editing), `generate_new` (create title, tags, and lyrics from a subject), and `refine_existing` (polish meter, rhymes, and imagery).
- **Curated Musical Genres**: Includes presets for Indie Folk, 80s Synthwave, Cinematic Epic Rock, Pop Dance, Melodic Metal, Cyberpunk Industrial, and more.
- **Vocal Performance Styling**: Detailed vocal timbre options including female belted, warm acoustic lead, male raspy baritone, harmonies, and whispered styles.
- **Unified Save/Load Library**: Save, update, and load song JSON files directly in the unified `saved_prompts/` directory with category filtering.
- **Metadata Passthrough**: Passes song title cleanly to `ModusFlowSaveAudio` for `%title%` filename variable substitution and ID3 tagging.

## Inputs

### Required
- **title** (STRING): The song title. Used as the track name and filename substitution variable.
- **genre** (dropdown): Musical style descriptor (instruments, genre conventions, tempo atmosphere).
- **vocal_style** (dropdown): Timbre, vocal range, and performance style (e.g. `Female vocal, emotional, expressive, clear tone`).
- **mood** (dropdown): Emotional resonance and energy level.
- **template** (dropdown): Ready-made structured lyric templates (`Standard Pop/Rock`, `Acoustic Ballad / Folk`, `Cinematic Epic / Rock`, `Synthwave / Cyberpunk`, `Custom`).
- **lyrics** (STRING, multiline): The full song lyrics including section tags.
- **saved_song** (dropdown): Select and load any saved song JSON file from the unified `saved_prompts/` directory.

### AI Lyric Studio Controls (Optional)
- **ai_mode** (dropdown):
  - `disabled`: Manual / template mode. No network calls.
  - `generate_new`: Generates an original song (title, genre tags, vocal style, mood, and lyrics) from the provided topic/subject prompt.
  - `refine_existing`: Polishes, rewrites, and optimizes the current lyrics, rhyme scheme, and musical tags according to user instructions.
- **ai_provider** (dropdown):
  - `Ollama (Local)`: Connects to local Ollama server (`http://127.0.0.1:11434`).
  - `Ollama (Cloud)`: Connects to a remote/cloud Ollama server using `ollama_cloud_url` and optional `ollama_cloud_api_key`.
  - `Cloud (OpenAI / OpenRouter / Groq / DeepSeek)`: Standard OpenAI-compatible `/chat/completions` API using `cloud_api_url` and `cloud_api_key`.
- **ollama_model** (dropdown): Available models on the selected Ollama instance.
- **cloud_model** (STRING): Model identifier for OpenAI-compatible cloud providers (e.g., `deepseek/deepseek-chat`, `anthropic/claude-3.5-sonnet`, `openai/gpt-4o-mini`).
- **topic_or_subject** (STRING, multiline): The narrative theme, story prompt, or specific revision instructions for the LLM.
- **web_search** (dropdown: `disabled` / `enabled`): When enabled, searches DuckDuckGo for factual research to enrich lyrics with authentic lore.
- **structure_guide** (STRING, multiline): Editable song architecture specification defining sections, line counts, and rhyme requirements.
- **temperature** (FLOAT): Creativity slider (0.0 – 2.0, default 0.75).
- **seed** (INT): Seed for reproducible song generation.

### Additional Styles (Optional)
- **additional_style** (STRING): Custom descriptors to append (e.g. `reverb, 120 bpm, acoustic bass, minor scale`).
- **negative_style** (STRING): Undesired sonic traits (e.g. `harsh noise, clipping, distorted vocals, robotic glitch`).

### Interactive UI & Popout Songwriter Studio Cockpit
- **🎵 Popout Songwriter Studio**: Launches a floating, resizable, and dockable dual-pane studio window with live bidirectional canvas synchronization.
- **Lyric Section Syntax Highlighting**: Real-time syntax highlighting featuring neon section banners (`[Verse 1]`, `[Chorus]`, `[Bridge]`, `[Outro]`), soft italic performance cues `(backing vocals)`, and chord/timing tags.
- **Quick Section Insert Ribbon**: Instant one-click section insertion for `[Intro]`, `[Verse 1]`, `[Verse 2]`, `[Pre-Chorus]`, `[Chorus]`, `[Hook]`, `[Bridge]`, `[Solo]`, `[Outro]`, and `(Backing Vocals)`.
- **Undo / Redo History Stack**: 60-level undo/redo history with dedicated toolbar buttons and standard `Ctrl+Z` and `Ctrl+Y` / `Ctrl+Shift+Z` keyboard shortcuts.
- **Live Word & Duration Estimation**: Real-time line counters, word counters, and singing duration estimation based on ~130 WPM musical tempo.
- **Musical Style Pedals**: Quick toggle chips for audio attributes (`Studio Master`, `Analog Warmth`, `Clear Vocals`, `Punchy 808`, `Driving Bass`, `Epic Reverb`, `Acoustic Live`, `Atmospheric Strings`).
- **Typography Controls**: Selectable font families (Monospace, Fira Code, JetBrains Mono, Clean Sans, Editorial Serif) and font size scaling (`A-` / `A+`) with persistent geometry in `localStorage`.
- **Category Filter & Library**: Filter and load saved song JSON presets with category grouping, `💾 Save Song`, `🗂️ Update Selected`, and `🔄 Refresh List`.
- **🔄 Refresh Models**: Reload the available Ollama models dynamically.

## Outputs
- **style_prompt** (STRING): Cohesive musical and vocal prompt ready for ACE-Step, DiffRhythm, or YuE.
- **lyrics** (STRING): Clean, formatted lyrics with section markers (`[intro]`, `[verse 1]`, `[chorus]`, etc.).
- **title** (STRING): Song title for saving and audio file naming.
- **negative_style** (STRING): Negative conditioning string.

## Configuration & Environment Variables

Cloud and Ollama settings can be set in `config.json` or through environment variables:

| Setting | Environment Variable | Default |
|---|---|---|
| `ollama_url` | `MODUSFLOW_OLLAMA_URL` | `http://127.0.0.1:11434` |
| `ollama_cloud_url` | `MODUSFLOW_OLLAMA_CLOUD_URL` | `""` |
| `ollama_cloud_api_key` | `MODUSFLOW_OLLAMA_CLOUD_API_KEY` | `""` |
| `cloud_api_url` | `MODUSFLOW_CLOUD_API_URL` | `https://openrouter.ai/api/v1` |
| `cloud_api_key` | `MODUSFLOW_CLOUD_API_KEY` | `""` |
| `cloud_model` | `MODUSFLOW_CLOUD_MODEL` | `deepseek/deepseek-chat` |

