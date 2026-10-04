# Text Editor

Interactive text editor with positive/negative prompt management and save/load functionality.

## Overview

The Text Editor node provides a full-featured dual text editing interface (Positive and Negative prompts) with save/load capabilities, perfect for managing complex prompts in ComfyUI workflows. Prompts are stored as JSON files containing a category, positive text, and negative text.

## Features

- **Dual Editor**: Separate Positive and Negative text areas
- **Live Syntax Highlighting**: Real-time on-canvas syntax color highlighting for comments, dynamic choices, pick-n ranges, weighted odds, wildcards, prompt variables, attention weights, curator placeholders, and LoRAs
- **Syntax Theme Selector**: Dropdown selector supporting multiple themes (Modus Neon, Cyberpunk 2077, Monokai Pro, Dracula Night, Nord Frost, Solarized Dark, High Contrast, and Plain Text)
- **JSON Theme Configuration**: Fully customizable `syntax_themes.json` file for styling your own color themes
- **Save/Load System**: Persistent storage as JSON files (`type`, `category`, `positive`, `negative`)
- **Type & Category Filtering**: Filter by Type (`Prompts`, `Songs`, `All`) and Category (`Portraits`, `Landscapes`, `Song`, etc.)
- **Cross-Node Interoperability**: Can load prompts or songs created across ModusFlow text nodes (Song Writer, ACE Audio, Ollama Refiner)
- **File Browser**: Browse and load saved prompts from a dropdown
- **Update in Place**: Overwrite an existing prompt with current text
- **Custom Directory**: Configure save location via `config.json` or ComfyUI Settings
- **Pass-through Outputs**: Positive/negative text, seed integer, direct CLIP conditioning (`positive_cond`, `negative_cond`), and pipeline passthrough (`PIPE`)
- **Direct CLIP Encoding**: Wire an optional `clip` or `pipe` to encode conditionings directly without separate CLIPTextEncode nodes
- **Workflow Tools**: Tag weight stepping (`Ctrl+Up/Down`), prompt deduplication, baseline negative presets, session history, and live resolved preview

## Inputs

### Required
- **positive** (STRING): Positive prompt text (large editor area)
- **negative** (STRING): Negative prompt text (smaller editor area, resizable)
- **saved_prompt** (dropdown): Select a previously saved `.json` prompt file
- **weight_mode** (dropdown): Model weight adaptation strategy:
  - `Pass-Through (SDXL / Pony)`: Preserves raw numerical weights `(tag:1.3)`.
  - `Translate for Chroma / Flux (Linguistic Emphasis)`: Converts weights to descriptive natural language tokens for T5-XXL.
  - `Front-Load Priority (Chroma / Flux)`: Converts weights and prepends high-priority terms (>= 1.2) to the front of the prompt.
  - `Strip Weights (Clean Tags)`: Removes all weights and parentheses for clean text.

### Optional
- **seed** (INT): Seed controlling deterministic evaluation of `{a|b|c}`, `{shuffle: ...}`, and wildcards (set to 0 for random).
- **seed_action** (dropdown): Seed evolution behavior (`fixed`, `randomize`, `increment`, `decrement`).
- **clip** (CLIP): Optional CLIP model to encode prompt text directly into conditionings.
- **pipe** (PIPE): Optional ModusFlow pipeline (`model`, `clip`, `vae`, `positive`, `negative`) for seamless pass-through.
- **mute_negative** (BOOLEAN): Instantly mute/bypass negative prompt output without deleting text notes.
- **curator_input** (STRING): Curated trait from `ModusFlow List Curator`. Replaces `{curator}` (or `{list}`, `{item}`) **directly in place** in the positive prompt (or appends if no placeholder is typed).
- **curator_input_2** (STRING): Secondary curated trait. Replaces `{curator2}` **directly in place** in the positive prompt.
- **curator_negative** (STRING): Curated negative trait. Replaces `{curator}` in the negative prompt.
- **positive_input** (STRING): Positive text from another node (overrides widget)
- **negative_input** (STRING): Negative text from another node (overrides widget)
- **positive_embedding** (STRING): Embedding string to append to positive text (e.g., from LoRA Loader)
- **negative_embedding** (STRING): Embedding string to append to negative text

## Outputs

- **positive** (STRING): Processed, comment-filtered, wildcard-resolved positive prompt text
- **negative** (STRING): Processed, comment-filtered, wildcard-resolved negative prompt text
- **seed** (INT): Seed passthrough (connects to KSampler, Save Image `%seed%`, LoRA Loader, etc.)
- **positive_cond** (CONDITIONING): Directly encoded positive conditioning (when `clip` or `pipe` is connected)
- **negative_cond** (CONDITIONING): Directly encoded negative conditioning (when `clip` or `pipe` is connected)
- **pipe** (PIPE): Updated ModusFlow pipeline containing active model, clip, vae, and newly encoded conditionings

> [!TIP]
> For a full tutorial on weight adaptation, tag shuffling, wildcards, and dynamic choices, see the [Text Editor & Wildcard Mastery Guide](guides/text-editor-mastery.md).

## UI Features

### Text Editors
- **Positive**: Large text area for comfortable editing
- **Negative**: Smaller default height but fully resizable
- Both support multi-line, word wrapping, undo/redo (Ctrl+Z / Ctrl+Y)
- **Tag Weight Stepping**: Select a tag (or place cursor inside a word) and press `Ctrl + Up` or `Ctrl + Down` (Cmd+Up/Down on Mac) to adjust numerical weights by $\pm 0.05$ (e.g. `tag` $\rightarrow$ `(tag:1.05)` $\rightarrow$ `(tag:1.1)`). Stepping down to 1.0 automatically unwraps to clean plain text.
- **Front-Load Priority Hotkey (`Alt + Home` / `Alt + Left`)**: Teleports the tag under the cursor or active selection directly to the very beginning of the prompt, granting it immediate CLIP/T5 priority.
- **Tag Randomizer on Selection (`Alt + D`)**: Instantly resolves dynamic choices `{a|b|c}` or `{shuffle: ...}` within the selection or at cursor into a single random outcome in-place.
- **Negative Presets**: Quick-fill dropdown for curated quality baselines (*SDXL Quality*, *Pony Score Baseline*, *Photorealistic*, *Anime / 2D Quality*, *Flux / Chroma Minimal*).
- **Live Token & Word Counter + Unclosed Parentheses Warning**: Real-time counter badge at the bottom-right corner showing word count, estimated CLIP tokens, and 75-token chunks. Flags unmatched or unclosed parentheses with an immediate alert badge (e.g., `⚠️ 1 unclosed ( )`).
- **Drag & Drop Image Metadata**: Drop any `.png` or `.webp` generated image onto the node (or directly into the text boxes) to instantly extract the positive prompt, negative prompt, and seed. Tailored specifically for `ModusFlowTextEditor`: when a workflow contains multiple text editor nodes, it intelligently traces the execution graph and canvas link topology to extract from **the node actively connected to downstream samplers, pipelines, and conditionings** rather than inactive or draft nodes. Also seamlessly falls back to standard ComfyUI CLIP/KSampler pairs and A1111/Forge `parameters`.

### Action Toolbar
- **✨ Enhance with Ollama**: One-click local AI prompt expansion! Sends the current positive prompt to your local Ollama LLM to enrich lighting, atmosphere, and sensory details in-place. Features automatic model detection via a dynamic dropdown in ComfyUI Settings, live status diagnostics, and non-blocking availability checks that never stall canvas loading. Shift+Click or click when offline (or right-click $\rightarrow$ **🤖 Ollama Status & Model Settings...**) to inspect connection status, test endpoints, or switch models on the fly.
- **⚡ Quick Chips**: Opens an interactive modal with curated visual tag chips organized into *Lighting & Atmosphere*, *Optics & Framing*, *Style & Aesthetics*, and *Mood & Color Palette*. Features a real-time filter search and one-click insertion at the cursor.
- **🔍 Prompt Diff**: Visual side-by-side or token diff viewer comparing the active prompt against any recent history snapshot or disk save, clearly highlighting added and removed tags.
- **💾 Save Prompt**: Prompts for a filename and optional category, saves both texts as a `.json` file, and automatically selects the newly saved prompt in the picker dropdown (matching the List Curator behavior)
- **✏️ Update Selected**: Overwrites the currently selected prompt with current text and keeps it selected
- **🔄 Refresh List**: Reloads the dropdown to reflect newly added prompt files
- **🧹 Prettify / Dedupe**: One-click cleanup to eliminate duplicate tags, collapse duplicate commas, and normalize tag spacing
- **🔍 Preview Resolved**: Opens a live simulation modal showing exactly how dynamic prompts `{a|b}`, `{shuffle}`, and weight translation resolve with any seed
- **🕒 Prompt History**: Browse and restore recent session snapshots from local storage

## Ollama AI Integration & Status Diagnostics

The Text Editor integrates directly with your local Ollama instance for instant prompt enhancement:

### Settings Panel (`ComfyUI Settings -> ModusFlow`)
1. **Ollama Server URL (`ModusFlow.OllamaURL`)**: Endpoint for your Ollama service (defaults to `http://127.0.0.1:11434` or custom LAN IP like `http://192.168.x.x:11434`). Automatically sanitizes whitespace, trailing slashes, and accidental trailing dots (e.g., `205.:11434`).
2. **Enhancement Model Dropdown (`ModusFlow.OllamaEnhanceModel`)**: Automatically discovers installed models from your Ollama server (e.g. `deepseek-r1`, `dolphin-mistral`, `llama3.2`, `qwen2.5`, etc.) and presents them in a dropdown combo for easy selection.
3. **Check Status / Connection Test (`ModusFlow.OllamaCheckStatus`)**: A dedicated **"🔍 Check Status / Refresh"** button that immediately probes the endpoint and displays a live badge: `🟢 Online (X models detected)` or `🔴 Offline`.

### On-Node Status & Model Modal
- **Clicking when Offline**: If Ollama was offline or recovering, clicking **✨ Enhance with Ollama (Offline)** runs an immediate live probe and, if still unreachable, opens the diagnostic modal with exact error details and troubleshooting tips.
- **Shift+Click or Alt+Click**: Opens the **Ollama Status & Models** modal anytime from the node button.
- **Right-Click Context Menu**: Right-click the `ModusFlowTextEditor` node and choose **🤖 Ollama Status & Model Settings...** to check connection status and switch active models directly on the canvas without opening settings.

## Live Syntax Highlighting & Themes

The Text Editor includes a real-time, zero-latency syntax highlighting engine rendered directly behind both the Positive and Negative prompt textareas.

### Highlighted Syntax Tokens

| Token Type | Syntax Example | Description |
|---|---|---|
| **Comments** | `/* notes */`, `# comment`, `// idea` | Dimmed/subtle color indicating exclusion from generation |
| **Variables** | `$lighting = neon ambient;`, `$lighting` | Distinct accent color for prompt variable definitions and references |
| **Dynamic Choices** | `{red \| blue \| green}` | Bracketed options highlighted for easy scanning |
| **Pick-N & Ranges** | `{2$$red \| blue \| green}`, `{1-3$$tags}` | Dynamic combination generators highlighted |
| **Weighted Odds** | `{80::day \| 20::night}` | Probability weighted choices highlighted |
| **Tag Shuffling** | `{shuffle: cyber, punk, neon}` | Shuffle blocks highlighted |
| **Wildcards** | `__lighting/studio__`, `__clothing__` | Double underscore wildcards highlighted |
| **Attention Weights** | `(sharp focus:1.2)`, `(grain:0.8)` | Attention weight numbers and terms highlighted |
| **Curator Inputs** | `{curator}`, `{curator2}` | Curated trait placeholders highlighted |
| **LoRAs** | `<lora:ChromaHD_Details:0.8>` | LoRA model tags highlighted |

### Theme Dropdown Selector

The node UI features a dedicated **Syntax Theme** dropdown selector placed right above the filters. Changing the theme updates both Positive and Negative editors immediately:
- **Modus Neon (Default)**: Modern dark mode with neon accents
- **Tomorrow Night Eighties**: Classic warm retro-dark coding palette
- **Cyberpunk 2077**: Electric cyan, hot magenta, and neon yellow
- **Monokai Pro**: Classic code editor palette
- **Dracula Night**: Deep purple and vibrant pastel accents
- **Nord Frost**: Calm arctic blues, snow whites, and cool teals
- **Solarized Dark**: Precision low-contrast solarized palette
- **High Contrast**: Vivid punchy colors on deep black
- **Off (Plain Text)**: Disables highlighting and restores standard ComfyUI text styling

### JSON Theme Configuration & Templates (`syntax_themes.json.example`)

The repository includes `syntax_themes.json.example` as a template containing all default themes. If `syntax_themes.json` does not exist on startup, the system automatically creates it from `syntax_themes.json.example`. Because `syntax_themes.json` is user-specific and excluded from git, you can safely modify themes or add your own custom palettes without dirtying git status or conflicting with repository updates.

You can also place `syntax_themes.json` inside your custom `saved_prompts/` directory if you prefer to keep your theme presets together with your saved prompt library.

```json
{
  "active_theme": "Modus Neon (Default)",
  "themes": {
    "My Custom Theme": {
      "comment": "#6b7280",
      "choice": "#c084fc",
      "shuffle": "#f472b6",
      "wildcard": "#fbbf24",
      "variable": "#38bdf8",
      "weight": "#34d399",
      "curator": "#4ade80",
      "lora": "#f87171",
      "plain_text": "#e2e8f0",
      "caret_color": "#ffffff",
      "bg_color": "#181825"
    }
  }
}
```

The node automatically reads this file through the `/modusflow/syntax_themes` API endpoint and populates the dropdown dynamically. Custom themes appear immediately in the selector.

## Configuration

Set the save directory in `config.json`:

```json
{
  "prompts_save_directory": "C:/path/to/your/prompts"
}
```

**Default:** `ComfyUI-ModusFlow/saved_prompts/`

### Directory Structure
Files are automatically organized into subdirectories by type:
- `saved_prompts/prompts/`: Text Editor prompts and refined prompts (`.json`)
- `saved_prompts/songs/`: Song lyrics and audio presets (`.json`)
  - `saved_prompts/songs/tags/`: Individual tag text files (`.txt`)
  - `saved_prompts/songs/lyrics/`: Individual lyric text files (`.txt`)

> **Auto-Migration:** On server startup or first access, existing prompt files in the root of `saved_prompts/` are automatically migrated into `saved_prompts/prompts/` (or `saved_prompts/songs/` if song metadata is detected), and all subdirectories are automatically initialized. Legacy `saved_songs/` items are also migrated seamlessly.

## JSON File Format

Each saved prompt is a `.json` file with the following structure:

```json
{
  "category": "Portraits",
  "positive": "beautiful woman, detailed face, soft lighting",
  "negative": "blurry, deformed, bad anatomy"
}
```

## File Management

### Saving Prompts
1. Edit text in the Positive and/or Negative editors
2. Click **💾 Save Prompt**
3. Enter a filename (without extension) and an optional category
4. File saved as `filename.json`

### Loading Prompts
1. Select a `.json` file from the dropdown
2. Both Positive and Negative fields are populated automatically

### Updating Prompts
1. Load a prompt from the dropdown
2. Edit the text
3. Click **✏️ Update Selected** to overwrite the file

### Organization
- All prompts saved as `.json` files
- Alphabetically sorted in the browser
- Click **🔄 Refresh List** to see newly saved files

## Usage Patterns

### Direct to Sampler
```
Model Loader → CLIP → Text Editor (edit prompt) → CLIP Text Encode → KSampler
```

### With Embeddings from LoRA
```
LoRA Loader → embedding_str → Text Editor (+ text)
                 ↓
             CLIP Text Encode → KSampler
```

### Prompt Library
```
Text Editor (empty) → Edit and save multiple prompts
                   → Load different prompts as needed
                   → Output conditioning to KSampler
```

### Prompt Refinement Workflow
```
Base Prompt → Ollama Refiner → Text Editor → CLIP Text Encode → Save refined version
                 ↓
               KSampler
```

### Text-Only Workflow
```
Text Editor → Text output → CLIP Text Encode → Conditioning
```

### Template System
```
Save prompt templates with placeholders
Load template → Edit specific parts → Generate with conditioning output
```

## Use Cases

### Style Prompts
- Save different art styles as templates
- Load and modify for each generation

### Negative Prompts
- Maintain library of negative prompts
- Load appropriate negatives per workflow

### Character Descriptions
- Store detailed character descriptions
- Mix and match traits from different prompts

### Scene Templates
- Save scene composition templates
- Reuse with variations

## Tips

- **Organization**: Use descriptive filenames (e.g., `portrait_style_realistic.txt`)
- **Backup**: Saved prompts directory can be backed up/synced
- **Version Control**: Save variants with version numbers
- **Snippets**: Save commonly used phrases/keywords as separate files

## Keyboard Shortcuts

- **Ctrl + / (Cmd + /)**: Toggle line comment (`# `) on selected line(s)
- **Ctrl + Shift + / (or Shift + Alt + A)**: Toggle block comment (`/* ... */`) around selection
- **Ctrl + A**: Select all text
- **Ctrl + C**: Copy
- **Ctrl + V**: Paste
- **Ctrl + Z**: Undo
- **Ctrl + Y**: Redo

## Intelligent Autocomplete System

The Text Editor features a built-in, context-aware autocomplete menu with real-time fuzzy filtering, categorized styling, and keyboard navigation.

### Triggers & Categories

| Trigger | Category | Badge | Description & Insertion Format |
|---|---|---|---|
| `__` | **Wildcards / Lists** | `LIST` | Auto-detects all list files in `saved_prompts/wildcards/`. Typing `__` or `__hair` brings up matching lists. Selecting inserts `__name__ `. |
| `$` | **Prompt Variables** | `VAR` | Extracts all declared (`$name = ...`) and referenced variables in your prompt text across both positive and negative editors. Selecting inserts `$name `. |
| `%` | **System Variables** | `SYS` | System variables including `%date%`, `%time%`, `%seed%`, `%model%`, `%width%`, `%height%`, `%steps%`, `%cfg%`. Selecting inserts `%name% `. |
| `{c` | **Curator Placeholders** | `CUR` | Fast insertion for `{curator}`, `{curator2}`, `{curator3}`, `{curator4}`, `{curator5}`, `{curator6}` slots. Selecting inserts `{curator} `. |
| `<l` or `<lora:` | **LoRA Models** | `LORA` | Scans available ComfyUI LoRA models. Selecting inserts `<lora:model_name:1.0> `. |

### Keyboard & Navigation Controls

- **Arrow Down (`↓`) / Arrow Up (`↑`)**: Move selection up and down with auto-scrolling
- **Enter / Tab**: Commit the selected suggestion, automatically inserting the syntax brackets and cursor space
- **Escape**: Dismiss the autocomplete popup without altering text
- **Mouse Click**: Direct single-click selection without losing cursor focus
- **Automatic Caching**: Lists and LoRAs are pre-cached and automatically updated when clicking **Refresh List** or focusing the editor


## Commenting Out Prompts (Exclusion Engine)

The editor allows you to comment out words, tags, or entire blocks so they are excluded from generation without losing your notes or having to delete text:

### 1. Block Comments (`/* ... */`)
Comment out phrases in the middle of a sentence or across multiple lines:
- **Middle of prompt**:
  ```text
  masterpiece, portrait of a woman, /* wearing sunglasses, */ red dress, 85mm
  ```
  *Output sent to CLIP/KSampler:* `masterpiece, portrait of a woman, red dress, 85mm`
- **Multi-line block**:
  ```text
  masterpiece, 8k,
  /*
  neon city street,
  rainy reflections,
  */
  cozy indoor studio, warm rim light
  ```

### 2. Line Comments (`#` or `//`)
Comment out entire lines or add notes at the end of a line:
```text
masterpiece, photorealistic portrait,
# vintage 80s film grain,
cinematic lighting, // test rim lighting later
```

### 3. Smart Comma Normalization
When commenting out tags in the middle of a prompt (e.g. `tag1, /* tag2, */ tag3`), the engine automatically cleans up duplicate commas (`,\s*,`), leading/trailing commas, and excess whitespace so your output prompt remains cleanly formatted.

### 4. Preserved in Saved Prompts & Workflows
All comments remain preserved in your editor UI, in saved JSON files, and in workflow PNG metadata, allowing you to maintain rich notes and alternate prompt variations indefinitely.

## Troubleshooting

- **Can't save**: Check `prompts_save_directory` in config.json
- **File not found**: Ensure directory exists and has write permissions
- **Not loading**: Click refresh or check dropdown for file
- **Missing files**: Verify `.txt` files are in correct directory
- **Ollama says "(Offline)" when it is running**:
  1. Click the button or Shift+Click to open the **Ollama Status & Models** modal and click **Check Status / Refresh**.
  2. Open ComfyUI Settings $\rightarrow$ ModusFlow and click **"🔍 Check Status / Refresh"** to view the live connection test.
  3. Ensure the URL does not contain typos or accidental trailing characters (e.g. `192.168.x.x.:11434` is automatically cleaned up, but ensure the port is `11434`).
  4. If Ollama is running on a different machine on your local network, ensure that machine has `OLLAMA_HOST=0.0.0.0` set so it listens for network connections, and verify your firewall allows port 11434.
