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
- **prompt_style** (dropdown / toolbar selector): Active target model prompting philosophy:
  - `Tags (SDXL / Pony)`: Formats and manages comma-separated weighted tags for Danbooru/tag-based models (Pony, SDXL, Illustrious). The Ollama prompt enhancer returns high-density visual tags, and negative pedalboards insert weighted syntax.
  - `Expressions (Flux / SD3)`: Formats and manages fluent natural language expressions and descriptive prose for modern T5 diffusion models (FLUX.1, SD3, Midjourney-style). The Ollama prompt enhancer returns vivid descriptive sentences without attention weights or tag soup, and negative pedalboards insert clean unweighted tokens.
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

- **positive** (STRING): Processed, comment-filtered, wildcard-resolved positive prompt text (retains resolved `<lora:name:strength>` tags for downstream nodes like **LoRA Loader** to detect and load)
- **negative** (STRING): Processed, comment-filtered, wildcard-resolved negative prompt text
- **seed** (INT): Seed passthrough (connects to KSampler, Save Image `%seed%`, LoRA Loader, etc.)
- **positive_cond** (CONDITIONING): Directly encoded positive conditioning (when `clip` or `pipe` is connected; automatically strips raw `<lora:...>` tags)
- **negative_cond** (CONDITIONING): Directly encoded negative conditioning (when `clip` or `pipe` is connected)
- **pipe** (PIPE): Updated ModusFlow pipeline containing active model, clip, vae, and newly encoded conditionings

> [!TIP]
> For a full tutorial on weight adaptation, tag shuffling, wildcards, and dynamic choices, see the [Text Editor & Wildcard Mastery Guide](guides/text-editor-mastery.md).

## UI Features

### Text Editors
- **Positive**: Large text area for comfortable editing
- **Negative**: Smaller default height but fully resizable
- Both support multi-line, word wrapping, undo/redo (Ctrl+Z / Ctrl+Y)
- **Prompt Style Selector**: Toggle between `🏷️ Tags (SDXL / Pony)` and `✍️ Expressions (Flux / SD3)` directly from the node combo widget, the Pop-Out Studio toolbar, or the Studio Tools menu.
- **Tag Weight Stepping**: Select a tag (or place cursor inside a word) and press `Ctrl + Up` or `Ctrl + Down` (Cmd+Up/Down on Mac) to adjust numerical weights by $\pm 0.05$ (e.g. `tag` $\rightarrow$ `(tag:1.05)` $\rightarrow$ `(tag:1.1)`). Stepping down to 1.0 automatically unwraps to clean plain text.
- **Move Line Up / Down (`Alt + Up` / `Alt + Down`)**: Transposes the current line or selection up or down without cutting/pasting. Ideal for adjusting CLIP prompt priority.
- **Duplicate Line Down (`Shift + Alt + Down`)**: Duplicates the current line or selected block directly below in one keystroke.
- **Send to Opposite Prompt (`Ctrl + Shift + N`)**: Cuts the active selection from the positive prompt and appends it to negative (or vice versa), cleaning up commas automatically.
- **Find & Replace (`Ctrl + F` / `Ctrl + H`)**: Opens a floating, non-intrusive Find & Replace bar with live match counter, Prev/Next buttons, Replace, Replace All, Case-Sensitive (`Aa`), and Regex (`.*`) support.
- **4-Space Tab Indentation & Dedent (`Tab` / `Shift + Tab`)**: Pressing `Tab` indents by 4 spaces (`"    "`) rather than inserting a literal `\t` tab character or moving focus out of the editor. If multiple lines are selected, `Tab` indents each selected line by 4 spaces. Pressing `Shift + Tab` dedents (unindents) the line or selection by up to 4 spaces. Any literal `\t` tab characters pasted or entered into the editor are automatically normalized to 4 spaces.
- **Prompt Snippets / Macros (Tab Expansion)**: Type a shortcut trigger like `!cine`, `!photo`, `!anime`, `!clean`, `!cyber`, `!portrait`, or `!neg` and press `Tab` to expand into comprehensive visual descriptor bundles.
- **Interactive Color Hex Inspector & Natural Color Resolver**: Type any `#RRGGBB` or `#RGB` hex code (e.g. `#e63946`, `#2a9d8f`, `#3a86ff`). The editor renders the text in that exact color with a subtle glowing pill container. Clicking or placing your cursor on it opens a floating inspector showing:
  - Exact live color swatch, RGB, and HSL metrics.
  - **Nearest Prompt-Friendly Name** (e.g. `#e63946` $\rightarrow$ `"vibrant crimson red"`), solving the problem of diffusion models not understanding raw hex codes!
  - **✨ Replace with Natural Color** button: one-click replacement of the hex code into the model-understandable color name.
  - **Visual Color Picker**: Built-in color picker to visually tweak colors and insert them in real time.
- **Prompt Variable Peek**: Placing your cursor on or clicking any `$variable` token displays a floating card showing its defined value from the prompt header.
- **Front-Load Priority Hotkey (`Alt + Home` / `Alt + Left`)**: Teleports the tag under the cursor or active selection directly to the very beginning of the prompt, granting it immediate CLIP/T5 priority.
- **Tag Randomizer on Selection (`Alt + D`)**: Instantly resolves dynamic choices `{a|b|c}` or `{shuffle: ...}` within the selection or at cursor into a single random outcome in-place.
- **Negative Presets**: Quick-fill dropdown for curated quality baselines (*SDXL Quality*, *Pony Score Baseline*, *Photorealistic*, *Anime / 2D Quality*, *Flux / Chroma Minimal*).
- **Live Token & Word Counter + Unclosed Parentheses Warning**: Real-time counter badge at the bottom-right corner showing word count, estimated CLIP tokens, and 75-token chunks. Flags unmatched or unclosed parentheses with an immediate alert badge (e.g., `⚠️ 1 unclosed ( )`).
- **Prompt Health & Deduplication Badge (`🟡 X duplicates [Fix]`)**: Real-time linter badge positioned at the bottom-left of the textarea (on both the canvas node and inside Pop Out Studio). Detects duplicate tags across lines and commas (including weighted variants), displaying a tooltip with the detected duplicates. Clicking the badge instantly deduplicates and prettifies the prompt in-place. Also alerts if attention weights exceed safe thresholds (`⚠️ X high weight (>1.6)`).
- **Drag & Drop Image Metadata**: Drop any `.png` or `.webp` generated image onto the node (or directly into the text boxes) to instantly extract the positive prompt, negative prompt, and seed. Tailored specifically for `ModusFlowTextEditor`: when a workflow contains multiple text editor nodes, it intelligently traces the execution graph and canvas link topology to extract from **the node actively connected to downstream samplers, pipelines, and conditionings** rather than inactive or draft nodes. Also seamlessly falls back to standard ComfyUI CLIP/KSampler pairs and A1111/Forge `parameters`.

### Action Toolbar
- **✨ Enhance with Ollama**: One-click local AI prompt expansion! Automatically conditions its system prompt on the active **Prompt Style**:
  - In **Tags** mode: Produces rich visual keyword tags for SDXL/Pony.
  - In **Expressions** mode: Crafts fluent, descriptive natural English prose for FLUX.1/SD3.
  - Shift+Click or click when offline (or right-click $\rightarrow$ **🤖 Ollama Status & Model Settings...**) to inspect connection status, test endpoints, or switch models on the fly.
- **⇄ Style (Convert: Tags ↔ Expressions)**: One-click bidirectional prompt converter. Converts a Pony tag list to fluent natural prose for Flux (stripping negative weights), or converts a Flux prose prompt to clean keyword tags for Pony/SDXL.
- **⚡ Quick Chips**: Opens an interactive modal with curated visual tag chips organized into *Lighting & Atmosphere*, *Optics & Framing*, *Style & Aesthetics*, and *Mood & Color Palette*. Features a real-time filter search and one-click insertion at the cursor.
- **🎨 LoRA Deck**: Interactive modal displaying all `<lora:name:weight>` detected in your prompt. Features `[-]` and `[+]` ($\pm 0.1$) steppers, a continuous weight slider, and an instant **Mute/Unmute** toggle (wraps the LoRA in `/* ... */` comments so you can disable it without deleting your configuration).
- **⇄ Swap Prompts**: Instantly swaps text between Positive and Negative prompt textareas with one click.
- **◫ Explode / Collapse**: Toggles between **Exploded Mode** (formats comma-separated tags onto separate indented lines for surgical editing, moving lines with `Alt+Up/Down`, and line commenting with `Ctrl+/`) and **Collapsed Mode** (compresses multi-line tags back into clean comma-separated inline paragraphs).
- **🔍 Find / Replace**: Opens the floating Find & Replace search overlay (`Ctrl + F` / `Ctrl + H`).
- **🔍 Prompt Diff**: Visual side-by-side or token diff viewer comparing the active prompt against any recent history snapshot or disk save, clearly highlighting added and removed tags.
- **💾 Save Prompt**: Prompts for a filename and optional category, saves both texts as a `.json` file, and automatically selects the newly saved prompt in the picker dropdown (matching the List Curator behavior).
- **✏️ Update Selected**: Overwrites the currently selected prompt with current text and keeps it selected.
- **🔄 Refresh List**: Reloads the dropdown to reflect newly added prompt files.
- **🧹 Prettify / Dedupe**: One-click cleanup to eliminate duplicate tags, collapse duplicate commas, and normalize tag spacing.
- **🔍 Preview Resolved**: Opens a live simulation modal showing exactly how dynamic prompts `{a|b}`, `{shuffle}`, and weight translation resolve with any seed.
- **🕒 Prompt History**: Browse and restore recent session snapshots from local storage.

## Ollama AI Integration & Studio Settings Access

The Text Editor integrates directly with your local Ollama instance for instant prompt enhancement and offers multiple universal ways to manage configuration:

### Accessing ModusFlow Settings
You can open the ModusFlow configuration at any time through any of these entry points:
1. **ComfyUI Settings Panel**: Click the gear icon in ComfyUI, navigate to the **ModusFlow** category, or click the **"⚙️ Open ModusFlow Settings Dialog"** button.
2. **Persistent ComfyUI Menu Button**: Click the **⚙️ ModusFlow** button docked directly in ComfyUI's main sidebar menu.
3. **Pop-Out Studio Toolbar**: Click **⚙️ Settings** in the top ribbon.
4. **Canvas Node Menu**: Click **🛠️ Studio Tools ▾** $\rightarrow$ **⚙️ ModusFlow Settings...**.
5. **Right-Click Context Menu**: Right-click the `ModusFlowTextEditor` node and choose **⚙️ ModusFlow Studio & AI Settings...**.
6. **Browser Console**: Execute `window.modusflowShowSettings()`.

### Configuration Options
1. **Ollama Server URL (`ModusFlow.OllamaURL`)**: Endpoint for your local Ollama service (defaults to `http://127.0.0.1:11434` or custom LAN IP like `http://192.168.x.x:11434`). Automatically sanitizes whitespace, trailing slashes, and accidental trailing dots.
2. **Enhancement Model Dropdown (`ModusFlow.OllamaEnhanceModel`)**: Automatically discovers installed models from your Ollama server (e.g. `deepseek-r1`, `dolphin-mistral`, `llama3.2`, `qwen2.5`, etc.) and presents them in a dropdown combo for easy selection.
3. **Check Status / Connection Test (`ModusFlow.OllamaCheckStatus`)**: Dedicated test button that immediately probes the endpoint and displays a live badge: `🟢 Online (X models detected)` or `🔴 Offline`.
4. **Cloud LLM Integration**: Configure Cloud Base URL, API Key, and Model ID (OpenRouter, DeepSeek, OpenAI, Groq) for cloud prompt assistance.
5. **Civitai API Key**: Securely store your Civitai API key for high-resolution LoRA cards and metadata previews.
6. **Prompts Directory Override**: Specify a custom folder to store prompt presets across different workflows.

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
| **Hex Colors** | `#ff5733`, `#00ffff`, `#e63946` | Rendered in the exact hex color with glowing pill badge and interactive hover inspector |
| **Variables & Multiline Blocks** | `$lighting = { ... };`, `$desc = """..."""`, `$var` | Single-line and multiline variable block definitions and references |
| **Synced Tuples** | `[$hero, $color] = {[knight, silver] \| [mage, violet]};` | Coordinated multi-variable assignment from synchronized choice sets |
| **Piped Variable Filters** | `$hero \| title`, `$tag \| weight(1.35)` | Text transformations (`title`, `upper`, `lower`, `capitalize`, `trim`) and weight wrappers |
| **Inline Negative** | `masterpiece {!neg: bad hands, blurry}` | Automatically extracted and merged into Negative Prompt with concept deduplication |
| **Sequential Cycling** | `{seq: dawn \| noon \| dusk}`, `{cycle: ...}` | Deterministically steps to the next item on each queue run |
| **Numerical Ranges** | `{range: 18..35}`, `{range: 0.8..1.4:0.05}` | Inline random integer or float generator with optional step precision |
| **Workflow Macros** | `%seed%`, `%date%`, `%sampler%`, `%steps%` | Runtime workflow and environment tokens injected from active generation |
| **CASE Statements** | `{$season: spring => cherry blossoms \| * => meadow}` | Multi-branch pattern matching on variable values with relational operators and default fallback |
| **Ternary Conditionals** | `{$color==red?man:woman}`, `{$hat?fedora:hair}` | Conditional prompt expansion based on variable equality (`==`), inequality (`!=`), or truthiness |
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

## Studio Cockpit & Advanced Prompt Engineering Features

The Text Editor is built as the ultimate prompt engineering cockpit in ComfyUI, featuring real-time visual feedback, tactile controls, and non-blocking studio ergonomics:

### 1. Attention Weight Heatmap
- **Dynamic Heat Glow ($> 1.0$)**: Attention-weighted tags such as `(sharp focus:1.3)` or `(cyberpunk:1.5)` automatically emit a warm golden/amber glow proportional to the attention weight boost. As the weight increases, the aura and subtle background tint intensify.
- **Extreme Weight Warning ($> 1.5$)**: Weights exceeding $1.5$ are marked with a cautionary tooltip warning of potential over-saturation or generation burn artifacts.
- **De-Emphasis Dimming ($< 1.0$)**: Downweighted tags like `(grain:0.7)` are softly dimmed and desaturated, giving you an instantaneous visual heatmap of what the diffusion model will prioritize.

### 2. Studio Micro-Toasts (Zero Disruption)
- Replaces disruptive, canvas-freezing native browser `alert()` modal dialogs with smooth, modern glassmorphic floating toasts.
- Actions like saving a prompt, updating, copying clean text, copying JSON, AI enhancements, deduplication, and hex color translations display slick non-blocking confirmations in the upper-right corner.

### 3. CLIP 75-Token Chunk Boundary Guides
- The token counter badge in the bottom-right corner displays real-time word count, estimated CLIP tokens, and active chunk boundary progress:
  - Example: `42w · 58 tok (58/75 Ch.1)`
  - Example: `78w · 104 tok (29/75 Ch.2)`
- **`BREAK` Detection**: If the prompt contains a ComfyUI `BREAK` keyword, an illuminated `⚡ BREAK` badge appears to indicate explicit conditioning chunk splits.
- **Warning State**: Warns when unclosed parentheses are detected or when tokens exceed standard single-chunk limits.

### 4. Prompt Health & Deduplication Linter
- **Duplicate Tag Detection**: Analyzes comma-separated and space-separated prompt tags in real-time. If duplicate tags or repeated tokens are detected, a yellow health badge appears in the bottom-left corner (e.g. `🟡 2 duplicates [Fix]`).
- **One-Click Auto-Dedupe**: Clicking the `[Fix]` badge instantly eliminates duplicates (including repeated parenthesized tags like `(tag:1.2) (tag:1.2)`), normalizes missing commas, and displays a toast confirming the clean-up while saving an undo snapshot.
- **Heavy Weight Warning**: Flags weights strictly $>1.6$ to prevent unintentional prompt burning (safe weights $\le 1.6$ like $1.2$ or $1.4$ are not falsely flagged).
- **Interactive Scrollbars**: Both Positive and Negative textareas on the canvas node include custom vertical scrollbars with pixel-perfect geometry synchronization to the underlying syntax highlighter.
- **Seamless Canvas & Ollama Undo (`Ctrl+Z` / `Ctrl+Y`)**: Full undo and redo history stack covers all text modifications on both the canvas node and the Pop-Out Studio, allowing you to instantly revert Ollama enhancements, selection refinements, pedalboard guard toggles, and typing edits.

### 5. Negative Pedalboard (Tactile Guard Rack) with Style Awareness
Directly above the Negative prompt box, a hardware-inspired pedalboard rack lets you toggle essential negative protection layers with illuminated active states:
- **`✦ Quality`**: Toggles baseline quality protection:
  - In **Tags** mode: `(worst quality, low quality, normal quality:1.4)`
  - In **Expressions** mode: `worst quality, low quality, normal quality` (unweighted)
- **`🚫 Anatomy`**: Toggles anatomical and limb deformity protection:
  - In **Tags** mode: `(bad anatomy, bad hands, missing fingers, extra digits:1.3)`
  - In **Expressions** mode: `bad anatomy, bad hands, missing fingers, extra digits` (unweighted)
- **`🎨 3D Guard`**: Toggles CGI / 3D render guard for 2D or photorealistic models:
  - In **Tags** mode: `(cgi, 3d render, cartoon, illustration:1.2)`
  - In **Expressions** mode: `cgi, 3d render, cartoon, illustration` (unweighted)
- **`💧 Watermark`**: Toggles watermark, text, and signature suppression:
  - In **Tags** mode: `(watermark, text, signature, username:1.2)`
  - In **Expressions** mode: `watermark, text, signature, username` (unweighted)
- **Live State Sync**: The pedalboard buttons automatically illuminate (`active`) when their tags are present in the negative prompt, even if typed manually, and dim when removed.
- **Clean Disengagement**: Clicking an active pedal button cleanly strips out the guard regardless of whether it was stored in weighted or unweighted syntax.

### 6. Interactive 2D Color Spectrum Studio & Pigment Resolver
- **Visual Color Spectrum (`🌈 Color Spectrum`)**: Features a dedicated 2D Saturation-Brightness canvas and continuous rainbow Hue slider directly on the canvas node, the Pop-Out Studio toolbar, and the right-click menu.
  - **2D Canvas Spectrum**: Drag the reticle crosshair smoothly to adjust saturation (horizontal axis) and value/brightness (vertical axis).
  - **Rainbow Hue Bar**: 0° to 360° gradient slider to transition across the full color spectrum.
  - **Screen Eyedropper (`👁️`)**: Sample colors directly from your screen, UI, or previously generated images on the ComfyUI canvas using the native EyeDropper API.
- **Real-Time Diffusion Model Understanding**:
  - As you move across the spectrum, the studio continuously calculates what the diffusion model will perceive using colorimetric Euclidean distance matching against over 70 curated pigments.
  - Displays: **"Diffusion Model Understands As: [ natural pigment name ]"** (e.g. `#00ffff` $\rightarrow$ `electric cyan`, `#d4af37` $\rightarrow$ `metallic gold`, `#8a0303` $\rightarrow$ `blood red`).
  - Helps prompt crafters bridge the gap between digital hex colors and the text-encoder's trained semantic vocabulary.
- **One-Click Insertions**:
  - **`✨ Insert Model Name`**: Injects the model-friendly natural pigment description into the prompt.
  - **`# Insert Hex Code`**: Injects `#RRGGBB` with live color pill highlighting.
  - **Trait Suffix Builder**: Quickly append descriptors like `hair`, `eyes`, `lighting`, `neon glow`, `rim lighting`, or `outfit`.
  - **Target Selection**: Toggle insertion directly into either the **Positive Prompt** or **Negative Prompt**.
- **70+ Curated Model Pigment Presets**: Instant filter and click-to-tune swatches beneath the spectrum.
- **✨ Translate All Hex in Prompt**: One-click action available in the modal to automatically translate every hex code across both Positive and Negative prompts into natural descriptive pigment names, preserving choices, shuffles, and prompt syntax.

### 7. Interactive Tag Studio Mode ("Tag Matrix / Chip Flow")
- **Toggle via `🏷️ Tag Studio`**: Converts raw comma-separated prompt text into a visual, interactive chip grid.
- **Direct Weight Steppers**: Each tag pill features inline `+` and `-` buttons that adjust attention weight in increments of $\pm 0.05$ (or $\pm 0.1$ with Shift).
- **Mute / Solo Eye (`👁`)**: Temporarily disables a tag by wrapping it in non-destructive comments (`/* tag */`) without deleting it, allowing A/B prompt testing in seconds.
- **Drag-and-Drop Reordering**: Drag chips horizontally or vertically to change the prompt's attention hierarchy, instantly updating the underlying text buffer.
- **Category Dot Coding**: Tags are dynamically categorized and color-coded (Subject, Lighting, Camera, Environment, Style, Quality).

### 8. Section Folders & Prompt Outliner
- **Outliner Syntax**: Prompts containing block comments in the form `// [Section Name]` or `/* [Section Name] */` are parsed into collapsible visual folders:
  ```text
  // [Subject]
  masterpiece portrait of an android geisha, intricate cybernetic porcelain,
  
  // [Lighting & Atmosphere]
  cinematic rim light, soft volumetric fog, #38bdf8 neon backlight,
  
  // [Camera & Optics]
  shot on Hasselblad 80mm f/1.8, bokeh, photorealistic
  ```
- **Collapse / Expand**: Click the chevron on any section header to collapse long prompt sections while keeping your workspace organized.

### 9. CLIP Attention Waveform Visualizer ("EQ Bar")
- **3-Chunk Attention EQ**: Positioned directly beneath the editor, an illuminated horizontal waveform bar models token density across CLIP's 75-token boundaries:
  - **Chunk 1 (Tokens 1–75)**: High-priority immediate tokens.
  - **Chunk 2 (Tokens 76–150)**: Secondary context tokens.
  - **Chunk 3 (Tokens 151–225)**: Tail context tokens.
- **Attention Spikes**: Tags with weights $> 1.1$ render as luminous bars whose heights indicate the magnitude of the attention spike.
- **Interactive Inspection**: Hover over any bar segment to see the associated tag and token count.

### 10. Multi-Model Tone Converter & Bidirectional Style Translation
One-click prompt restructuring tailored to specific diffusion architectures:
- **`⇄ Style` / `Convert: Tags ↔ Expressions`**: Automatically converts your entire prompt between **Pony/SDXL Tags** and **Flux/SD3 Expressions**:
  - **Converting to Expressions**: Formats positive tags into fluent descriptive sentences and strips attention weights (e.g., `(worst quality:1.4)` $\rightarrow$ `worst quality`) from the negative prompt to prevent T5 text-encoder artifacts.
  - **Converting to Tags**: Normalizes descriptive prose into clean comma-delimited visual tags and sets the prompt style to Tags.
- **✍️ Prosify (Fluent / Natural Language)**: Converts tag soup (`cyberpunk girl, neon lights, rainy street, 8k, cinematic`) into coherent, descriptive natural English sentences tailored for **FLUX.1**, **SD3**, and **Midjourney-style** models.
- **🏷 Tagify (Booru / Danbooru Tags)**: Converts long descriptive prose into clean, comma-delimited keyword tags with proper weighting for **SDXL**, **SD 1.5**, and **Pony / Illustrious** models.

### 11. Visual Aesthetic Ribbon
A rapid, one-click visual dock above the editor to inject curated prompt tokens without manual typing:
- **🎞 Film Stocks**: Kodak Portra 400, Cinestill 800T, Fujifilm Velvia 50, Ilford HP5 Plus, Polaroid 600.
- **🔍 Optics & Lenses**: 85mm f/1.2 Portrait, 24mm f/1.4 Wide, 50mm Anamorphic, 100mm Macro.
- **💡 Lighting Rigs**: Rembrandt Lighting, Volumetric God Rays, Cyberpunk Neon Backlight, Golden Hour, Chiaroscuro.
- **📷 Camera Systems**: Hasselblad H6D-100c, ARRI Alexa Mini LF, 35mm Vintage SLR, Leica M11.

### 12. Permutation & Variation Grid Previewer
- **Dynamic Choice Matrix (`{ a | b }`)**: Click `🎲 Permutations` to calculate and preview all possible combinatorial variations generated by `{ a | b | c }` blocks.
- **One-Click Pick / Test**: Preview the exact resolved prompts before queueing generation, or copy specific variations directly into the editor.

### 13. Split-Screen Studio Cockpit & Compact Canvas Architecture
- **Streamlined Canvas Footprint**: To eliminate canvas clutter, the node on the ComfyUI canvas is streamlined to a clean $560 \times 580$ layout with 5 essential primary controls:
  - **`⛶ Pop Out Studio`**: Launches the dedicated floating workstation.
  - **`✨ Enhance with Ollama`**: One-click local LLM prompt enhancement with live model status.
  - **`💾 Save Prompt`**: Rapid preset saving.
  - **`🔄 Update Selected`**: Rapid updates to current prompt file.
  - **`🛠️ Studio Tools ▾`**: Opens a clean, categorized floating popup menu organizing all specialized utilities:
    - **Studio & Layout**: Pop Out Studio, Tag Studio Mode, Split Studio Layout.
    - **Styling & Color**: Color Spectrum Studio, Visual Aesthetic Ribbon, Active LoRA Deck, Quick Chips.
    - **Prose & Flow**: Prosify (Fluent Prose), Tagify (Tags & Weights), Swap Positive/Negative, Prettify & Dedupe, Translate All Hex Codes, Explode/Collapse Tags.
    - **Analysis & History**: Choice Variation Grid, Preview Resolved Prompt, Prompt Diff Viewer, Find & Replace, Prompt History, Refresh Saved Prompts.
- **Side-by-Side Cockpit**: Wide dual-pane workstation ($980 \times 680$) for widescreen and multi-monitor workflows.

### 14. Nested Dynamic Choices & Recursive Resolution
- **Nested `{this|this}` Inside Lists**: Full recursive syntax resolution supports nested choices inside choice blocks, wildcards inside lists, and variables inside choices (e.g., `{red|{blue|cyan}}`, or a list row containing `portrait with {cybernetic|organic} enhancements`).
- **CASE Statements (`{$var: pattern => result | * => default}`)**: Multi-branch switch/case statements that cleanly map variable values to prompt branches using pipe delimiters (`|`) and fat arrows (`=>`):
  - **Exact Value Matching**: `{$season: spring => cherry blossoms | summer => sunflower field | autumn => golden leaves | winter => snowy pines | * => lush meadow}`
  - **Multiple Matches Per Branch (Commas or Choice Sets)**: Group values either with comma-separated patterns (`futanari, man => things`) or dynamic choice sets (`{futanari|man} => things`). Both formats match if the variable equals any of the listed options.
  - **Relational Conditions in Cases**: Supports numerical and lexicographical comparisons: `{$level: >= 50 => grandmaster warrior | >= 20 => veteran knight | * => novice adventurer}`
  - **Default / Wildcard Fallbacks**: Any of `*`, `default`, `_`, or `else` acts as the fallback when no prior patterns match. If omitted and no branch matches, resolves to an empty string.
  - **Nested Dynamic Choices & Wildcards**: Branches fully support nested choice blocks, shuffles, wildcards, and ternaries: `{$season: spring => {cherry|peach} blossoms | winter => {snowy peaks|ice glaze}}`
  - **Prefix Flexibility**: Both `{$var: ...}` and `{case $var: ...}` syntax formats are recognized.
  - **Multiline Branch Assignments**: Each branch (`pattern => result`) can span multiple lines with its own indentation, tags, and inline comments:
    ```text
    {case $season:
        summer =>
            masterpiece, best quality,
            sundress, straw hat,
            tropical sun, sandy beach
        | winter =>
            masterpiece, best quality,
            heavy woolen coat, knitted scarf,
            snowy pine forest, soft falling snow
        | * =>
            casual shirt, blue jeans,
            clear afternoon
    }
    ```
  - **Assigning a Multiline CASE Statement to a Variable**: Wrap the statement in triple quotes (`""" ... """`) or braced blocks (`$var = { ... };`) to store the resolved branch into a reusable variable:
    ```text
    $mood = happy;

    $character_expression = """
    {case $mood:
        happy =>
            cheerful smile,
            sparkling eyes,
            rosy cheeks
        | sad =>
            melancholic gaze,
            tear on cheek,
            somber expression
        | * =>
            neutral expression
    }
    """;

    1girl, solo, $character_expression, portrait
    ```
  - **Dynamic LoRA Tagging (`<lora:name:strength>`)**: Embed dynamic LoRAs directly inside branch results so models switch conditionally based on variables:
    ```text
    $person = man;

    {case $person:
        man => <lora:Chroma\Gentleman_Chroma_V1:1.0> smiling gentleman
        | woman => <lora:Chroma\Lady_Chroma_V1:1.0> smiling lady
    }
    ```
    - **Syntax Flexibility**: Both `{case $var: ...}` (with colon) and `{case $var ...}` (without colon) are fully supported.
    - **Automatic Tag Stripping**: All `<lora:...>` tags are parsed and completely stripped from `output_positive` before conditioning and text display. They will **never** leak into prompt text viewers, saved image metadata, or standard CLIP text encoders.
    - **ModusFlow Ecosystem Integration**: When connected to the **ModusFlow LoRA Loader** via the existing `positive` (conditioning) or `pipe` wire, the extracted LoRA payload and clean prompt travel automatically in the conditioning metadata. The LoRA Loader dynamically applies the model and CLIP weights without requiring any extra cables or pre-declaring LoRAs in manual lists.
    - **Behavior With Other / Third-Party LoRA Loaders**: The Text Editor continues to work 100% as expected (all variables, branches, wildcards, and clean text resolve completely normally). Standard ComfyUI or third-party loaders do not inspect conditioning metadata or support dynamic prompt tags; they will safely and **silently ignore** the LoRA instruction, while receiving the clean prompt without syntax errors or broken tags.
  - **Multi-Attribute Branching Best Practices**: CASE branches output text directly into the prompt. To coordinate multiple attributes from a single condition:
    1. **Master Block Variable**: Group all related character and scene descriptors into the branch text of a single master variable.
    2. **Discrete Targeted Variables**: Define separate CASE variables per trait (e.g. `$lighting = {case $time: morning => soft dawn | night => neon};`).
    3. **Synced Choice Tuples**: Use `[$var1, $var2] = { [v1, v2] | [v3, v4] };` for lockstep coordinated sets.
- **Ternary If/Else Conditionals with Compound Boolean Logic (`{$cond ? true : false}`)**: Dynamically branch prompt output based on variable values, boolean flags, and compound logic:
  - **Compound Boolean Operators (`&&`, `||`, `!`)**: Combine conditions with short-circuit evaluation:
    - `{$is_night && $weather == "rain" ? stormy night : clear day}`
    - `{!$is_night || $weather == "snow" ? winter noon : midnight rain}`
    - `{($level >= 50 || $role in {paladin|hero}) && $is_night ? veteran night patrol : rookie}`
  - **Relational Comparisons**: `==`, `!=`, `<`, `>`, `<=`, `>=`, `in`, `not in` (e.g. `{$age >= 21 ? vintage wine : fruit juice}`).
  - **Choice Set Matching**: `{$class in {knight|paladin} ? heavy plate armor : leather tunic}`.
  - **Truthiness & Negation (`!`, `not`)**: `{$wearing_hat ? black fedora : messy hair}` or `{!$injured ? battle stance : recovering}`.
  - **Optional False Branch**: `{$color == "red" ? ruby gem}` (resolves to empty string if condition is not met).
  - **Nested Dynamic Choices**: Branches fully support choices and wildcards: `{$color == "red" ? {crimson|ruby} : blue}`.

- **Modular File Imports (`@import "path/file"`)**: Import and compose external prompt files modularly into your master workflow:
  - **Root & Subfolder Resolution**: Looks relative to your configured `saved_prompts` directory (and subfolders such as `lib/`, `presets/`, `styles/`, etc.):
    ```text
    @import "styles/cyberpunk"
    1girl, solo, in futuristic jacket,
    @import "lighting/dramatic_rim.txt"
    ```
  - **Format Support (.txt and .json)**:
    - `.txt`: Injects raw prompt text, YAML dictionaries, or multi-entry dictionary lists.
    - `.json`: Automatically parses saved prompt JSON files (extracting the `positive` prompt) or data JSON files (parsed as dictionaries or lists).
  - **First-Class Data Structures in Imports**:
    Just like wildcard lists, files loaded via `@import` seamlessly support dictionary and array structures:
    - **YAML Dictionaries (`hero.txt`)**:
      ```text
      $hero = @import "characters/hero.txt";
      1girl $hero.name as $hero.role wielding $hero.weapon
      ```
    - **Multi-Entry Dictionary Lists (`heroes.txt`)**:
      ```text
      $party = @import "characters/heroes.txt";
      Party Leader: $party[0].name (Count: $party.length)
      ```
    - **JSON Data Files (`gear.json`)**:
      ```text
      $gear = @import "items/gear.json";
      Equipped: $gear.helm and $gear.boots
      ```
    - **Direct Iteration in Loops**:
      Loop directly over an imported list of dictionaries:
      ```text
      for $m in @import "characters/heroes.txt" {
          1girl $m.name as $m.role wielding $m.weapon,
      }
      ```
  - **Optional Extension**: Omitting the extension will automatically test `path`, `path.txt`, and `path.json`.
  - **Recursive Imports**: Imported files can themselves contain `@import` statements (with built-in recursion guard up to 5 levels).

- **Reusable Macro Functions (`fn name($arg1, $arg2) = { ... };` and `@name(...)`)**: Define reusable, parameterized prompt template functions directly in your prompt text or imported libraries:
  - **Definition Syntax**:
    ```text
    fn portrait($char, $style) = {
        masterpiece 8k portrait of $char, in $style aesthetic, cinematic lighting, sharp focus
    };

    fn glowing_weapon($weapon, $color) = legendary $weapon wreathed in vibrant $color flames;
    ```
  - **Invocation Syntax**:
    ```text
    $protagonist = "valkyrie";
    $theme = "norse mythology";

    @portrait($protagonist, $theme), carrying a @glowing_weapon("spear", "azure")
    ```
  - **Parameter Substitution**: Function arguments map directly to `$param` variables inside the template body. Arguments can be literals (`"spear"`), variable references (`$protagonist`), or unquoted tokens (`azure`).
- **Loops & Repetition (`repeat(count)` and `for ... in ...`)**: Generate structured tag sequences, ensemble character rosters, and repeated scene elements programmatically:
  - **Numerical Repeater (`repeat(count) { body }`)**:
    - Repeats the body template $N$ times (clamped between 1 and 20 to preserve CLIP token budgets):
      ```text
      repeat(3) {
          detailed floating lantern #$index,
      }
      ```
      Resolves to: `detailed floating lantern #1, detailed floating lantern #2, detailed floating lantern #3,`
    - **Independent Choice Evaluation**: When dynamic choices `{a|b}` appear inside a `repeat` block, each iteration re-rolls independently:
      ```text
      repeat(4) {
          {glowing|hovering} {crimson|azure} crystal,
      }
      ```
    - **Iteration Variables**: Built-in `$index` (1-based: 1, 2, 3...) and `$i` (0-based: 0, 1, 2...), or explicit alias `repeat(3 as $step)`.
  - **First-Class Arrays, Lists & Dictionaries**:
    - **Array / List Declarations**:
      ```text
      $elements = [fire, frost, lightning];
      $weights = [1.1, 1.25, 1.4];
      ```
      - Direct Indexing: `$elements[0]` $\rightarrow$ `fire`, `$elements[-1]` $\rightarrow$ `lightning`.
      - Count / Length: `$elements.length` or `$elements | count` $\rightarrow$ `3`.
      - Direct expansion: `$elements` $\rightarrow$ `fire, frost, lightning`.
    - **Dictionary / Key-Value Map Declarations**:
      ```text
      $hero = {
          name: "Valkyrie",
          hair: "long braided silver hair",
          eyes: "piercing azure eyes",
          weapon: "runic lightning spear",
          role: "tank"
      };
      ```
      - Dot Property Access: `$hero.name`, `$hero.weapon`, `$hero.role`.
      - Bracket Key Access: `$hero["hair"]`, `$hero['eyes']`.
      - Direct expansion: `$hero` $\rightarrow$ `name: Valkyrie, hair: long braided silver hair, ...`.
    - **Array of Dictionaries (Squad Rosters & Scene Entities)**:
      ```text
      $party = [
          { name: "Valkyrie", role: "tank", weapon: "tower shield" },
          { name: "Lyra", role: "mage", weapon: "crystal staff" }
      ];
      ```
      - Indexed Property Access: `$party[0].name` $\rightarrow$ `Valkyrie`, `$party[1].weapon` $\rightarrow$ `crystal staff`.
    - **Wildcard Lists as First-Class Data Structures (`$hero = __listname__`)**:
      Wildcard list files in `saved_prompts/wildcards/` (or your configured prompts directory) are automatically recognized and parsed as first-class `PromptDict` and `PromptList` data structures:
      - **Multi-Line YAML-Style Key-Value Files (`hero.txt`)**:
        Place key-value pairs directly in a wildcard text file:
        ```text
        // saved_prompts/wildcards/hero.txt
        name: "MyName"
        role: "tank"
        weapon: "aegis shield"
        armor: "adamant plate"
        ```
        In the Text Editor:
        ```text
        $hero = __hero__;
        1girl, solo, $hero.name as $hero.role equipped with $hero.weapon and $hero.armor
        ```
        Iterate over attributes:
        ```text
        $hero = __hero__;
        for $attr, $val in $hero {
            $attr: $val,
        }
        // ➜ name: MyName, role: tank, weapon: aegis shield, armor: adamant plate,
        ```
      - **Multi-Entry Dictionary Lists (`heroes.txt`)**:
        Format wildcard list files with one dictionary per line:
        ```text
        // saved_prompts/wildcards/heroes.txt
        { name: "Valkyrie", role: "tank", weapon: "spear" }
        { name: "Lyra", role: "mage", weapon: "staff" }
        { name: "Zephyr", role: "rogue", weapon: "daggers" }
        ```
        - **Random Single Entity Roll**: `$hero = __heroes__;` rolls a single random dictionary with dot access `$hero.name`, `$hero.role`, `$hero.weapon`.
        - **Complete Roster Import**: `$party = __all$$heroes__;` imports all entries into a `PromptList`. Access via `$party[0].name`, `$party.length`, or iterate through them.
        - **In-File `[ALL]` Directive**: Adding `[ALL]` or `#mode: all` as the first line of any wildcard `.txt` file automatically forces any standard reference like `__negatives__` to output all entries as a comma-separated list without needing `all$$`.
        - **Inline `{all$$...}` Choices**: Use `{all$$item1|item2|item3}` or `{all$$item1, item2, item3}` directly in prompts to emit all items comma-separated.
        - **`all(...)` Function Syntax**: Use `all(__wildcard__)`, `all(__wildcard__}`, or `all($list)` to evaluate and comma-separate all items from a wildcard list or variable.
        - **Direct Loop over Wildcard List**:
          ```text
          for $member in __heroes__ {
              1girl $member.name ($member.role wielding $member.weapon),
          }
          ```
      - **JSON Files (`.json`)**: Wildcard files with `.json` extensions containing objects `{ ... }` or arrays `[ ... ]` are parsed seamlessly into dictionary or list variables.
      - **Data Structure Filters**:
        - `$hero | keys` $\rightarrow$ `name, role, weapon, armor`
        - `$hero | values` $\rightarrow$ `MyName, tank, aegis shield, adamant plate`
        - `__all$$heroes__ | count` $\rightarrow$ `3`
  - **List & Array Iteration (`for $item in $list { body }`)**:
    - Iterates across variable lists, comma-delimited tokens, or inline brackets `[a, b, c]`:
      ```text
      $elements = [fire, lightning, frost];
      for $elem in $elements {
          (wreathed in $elem:1.25),
      }
      ```
      Resolves to: `(wreathed in fire:1.25), (wreathed in lightning:1.25), (wreathed in frost:1.25),`
  - **Indexed List Iteration (`for $idx, $item in $list`)**:
    - Access both the 0-based index and the item value:
      ```text
      for $idx, $color in [magenta, cyan, gold] {
          spotlight {$idx + 1}: $color rim lighting,
      }
      ```
  - **Dictionary Looping (`for $key, $val in $dict` or `for $val in $dict`)**:
    - Iterate across key-value pairs or values directly:
      ```text
      $traits = { hair: "silver", eyes: "blue", outfit: "tactical suit" };
      for $attr, $val in $traits {
          $attr: $val,
      }
      // ➜ hair: silver, eyes: blue, outfit: tactical suit,
      ```
    - Key enumeration: `for $k in $traits.keys() { trait: $k, }`
  - **Looping Arrays of Dictionaries (Multi-Character Scenes)**:
    - Directly reference entity properties inside the loop body:
      ```text
      for $m in $party {
          1girl $m.name as $m.role wielding $m.weapon,
      }
      // ➜ 1girl Valkyrie as tank wielding tower shield, 1girl Lyra as mage wielding crystal staff,
      ```
  - **Tuple Unpacking (`for [$a, $b] in $tuples`)**:
    - Iterate across multi-attribute rosters in lockstep:
      ```text
      $squad = [
          [valkyrie, winged helmet, runic spear],
          [paladin, polished silver plate, holy broadsword],
          [rogue, shadowed leather tunic, dual daggers]
      ];

      for [$class, $armor, $weapon] in $squad {
          1 $class wearing $armor and wielding $weapon,
      }
      ```
  - **Numerical Range Loops (`1..N` and `range(...)`)**:
    - `for $i in 1..4 { layer $i background, }`
    - `for $i in range(1, 5) { tier $i armor, }`
  - **Smart Delimiter Insertion**: If the body does not end with a comma, semicolon, or newline, iterations are automatically joined with `, `.
  - **Conditionals on Object Properties**: Test properties directly: `{$hero.role == "tank" ? heavy plate armor : cloth tunic}`.
  - **Variable Assignment**: Loops can be embedded inside variable definitions (`$crystals = { for $c in [ruby, emerald] { glowing $c crystal, } };`).

- **Percentage-Based Chance Modifiers (`{40%: text}`)**: Dynamically include scene elements, weather effects, or detail tags based on a random percentage probability:
  - **Syntax**: `{percentage%: text to include}`
    - `{40%: dramatic volumetric dust, }` (40% probability of being included; resolves to empty string if random roll is $\ge 40\%$)
    - `{25.5%: cybernetic arm enhancement}` (supports floating-point probabilities)
    - `{50%: wearing {red|blue} coat}` (nestable with dynamic choices)
  - **Clean Output**: If the chance roll fails, the tag resolves to empty string and any dangling double commas are automatically cleaned up.

- **Null-Coalescing Operator (`$var ?? "fallback"`, `{$var ?? "fallback"}`)**: Provide clean fallback values for optional or empty variables:
  - **Syntax**:
    - `$theme ?? "fantasy world"`
    - `$unset_var ?? "neon alley"`
    - `{$missing_var ?? "medieval castle"}`
  - **Behavior**: If `$var` is defined and non-empty (even if assigned an empty quoted string `""` or `''`), its value is used; otherwise, it resolves to the specified fallback token, quoted string, or secondary variable (`$var ?? $fallback_var`).

- **Inline Arithmetic Expressions (`{$var + 10}`, `(tag:{$weight + 0.2})`)**: Perform real-time mathematical operations directly inside your prompts:
  - **Supported Operators**: `+` (addition), `-` (subtraction), `*` (multiplication), `/` (division).
  - **Dynamic Attention Weight Stepping**:
    ```text
    $base_weight = 1.1;
    (masterpiece:{$base_weight + 0.2}), (cinematic lighting:{$base_weight + 0.05})
    ```
    Resolves to: `(masterpiece:1.3), (cinematic lighting:1.15)`
  - **Numerical Variables**:
    ```text
    $level = 20;
    character level: {$level + 5}, double power: {$level * 2}
    ```
    Resolves to: `character level: 25, double power: 40`
  - **Clean Formatting**: Integer calculations remain clean integers; floating-point results format up to 4 decimal places without floating-point rounding artifacts or trailing zeroes.

- **Expanded Piped Variable Filters (`$var | filter` and `{$var | filter}`)**: Transform variable strings on-the-fly with Unix / Jinja-style piping:
  - **String Case Transformations**:
    - `$hero | title`: Capitalizes each word (`"cyberpunk samurai"` $\rightarrow$ `"Cyberpunk Samurai"`).
    - `$hero | upper`: Converts to uppercase (`"valkyrie"` $\rightarrow$ `"VALKYRIE"`).
    - `$hero | lower` / `$hero | capitalize` / `$hero | trim`.
  - **Smart Grammar & Formatting**:
    - `$creature | plural`: Context-aware English pluralization (`"wolf"` $\rightarrow$ `"wolves"`, `"cherry"` $\rightarrow$ `"cherries"`, `"fox"` $\rightarrow$ `"foxes"`, `"cat"` $\rightarrow$ `"cats"`).
    - `$tags | strip_weights`: Strips attention weights and parentheses into clean plain tags (`"(masterpiece:1.3), ((ultra-detailed))"` $\rightarrow$ `"masterpiece, ultra-detailed"`).
    - `$colors | join(" + ")`: Splits comma-separated items and rejoins them with a custom delimiter (`"crimson, gold, emerald"` $\rightarrow$ `"crimson + gold + emerald"`).
  - **List & Dictionary Operations**:
    - `$list | count` / `$list | length`: Counts elements or dictionary keys (`$elements | count` $\rightarrow$ `3`).
    - `$dict | keys`: Extracts keys as a comma-separated list (`$hero | keys` $\rightarrow$ `name, hair, weapon`).
    - `$dict | values`: Extracts values as a comma-separated list (`$hero | values` $\rightarrow$ `Valkyrie, silver, spear`).
    - `$list | first`: First element (`$elements | first` $\rightarrow$ `fire`).
    - `$list | last`: Last element (`$elements | last` $\rightarrow$ `lightning`).
    - `$list | reverse`: Reverses elements (`$elements | reverse` $\rightarrow$ `lightning, frost, fire`).
    - `$list | sort`: Sorts elements alphabetically (`$elements | sort` $\rightarrow$ `fire, frost, lightning`).
  - **Weighting & Wrapping**:
    - `$tag | weight(1.35)`: Wraps the value in attention weight syntax: `(tag:1.35)`.
    - `$tag | wrap('prefix', 'suffix')`: Wraps value in custom delimiters.
    - `$var | default('fallback')`: Uses fallback if the variable resolves empty.
  - **Chaining Filters**: Pipe multiple transformations in sequence: `$creature | plural | upper` $\rightarrow$ `"WOLVES"`.
  - **Non-Conflicting Choice Isolation**: Filters only trigger on registered filter names. Expressions like `{$fruit | apple}` are safely recognized as dynamic choices between `$fruit` and `"apple"`, while `{$fruit | upper}` transforms the variable!

- **Inline Negative Injections (`{!neg: tags}`)**: Embed negative constraints directly inside positive prompt text without jumping to the negative box.
  - Example: `portrait of an android geisha {!neg: cartoon, 3d render, extra limbs}, holding porcelain cup {!neg: bad hands, broken fingers}`
  - **Smart Concept Deduplication**: When merged into the negative prompt, tags are deduplicated by base semantic concept (e.g. `(bad anatomy:1.4)` vs `bad anatomy` or identical duplicate tags are automatically consolidated to prevent negative prompt pollution).
- **Sequential Cycling (`{seq: a | b | c}` or `{cycle: a | b | c}`)**: Cycles deterministically through options on each queue execution instead of picking randomly:
  - Example: `courtyard at {seq: dawn | midday | golden hour | midnight rain}`
  - Run #1: `dawn` $\rightarrow$ Run #2: `midday` $\rightarrow$ Run #3: `golden hour` $\rightarrow$ Run #4: `midnight rain` $\rightarrow$ Run #5: `dawn` (loops cleanly).
- **Numerical Ranges (`{range: min..max[:step]}` or `{rand: ...}`)**: Inline integer and floating-point random number generators:
  - Integer range: `{range: 18..35}` (random int between 18 and 35) or `{range: 35..85:10}` (stepping by 10).
  - Float range: `{range: 0.8..1.4:0.05}` (stepping by 0.05) or `{range: 1.4..2.8:float}` (generates random float formatted to two decimals).
- **Synced Choice Tuples (`[$a, $b, ...] = { [a1, b1] | [a2, b2] };`)**: Synchronize multiple variables to roll together as a coordinated set:
  ```text
  [$element, $hair, $eyes] = {
      [fire, crimson hair, amber eyes] |
      [water, azure waves hair, sapphire eyes] |
      [nature, emerald braided hair, hazel eyes]
  };
  an elven archer aligned with $element, featuring $hair and $eyes
  ```
- **Multiline Variable Blocks**: Wrap multi-line prompt paragraphs, trait collections, or complex descriptions cleanly into a single variable:
  - **Braced Blocks (`$var = { ... };`)**: Ideal for multi-tag character or environment stacks with indentation and inline comments stripped cleanly:
    ```text
    $character = {
        masterpiece portrait, 1girl, solo,
        intricate cybernetic porcelain armor,
        flowing silver ponytail, mechanical eyepiece
    };
    ```
  - **Triple Quotes (`$var = """ ... """;`)**: Python-style multiline blocks:
    ```text
    $setting = """
        ancient mossy stone ruins,
        bioluminescent blue mushrooms,
        soft drifting volumetric dust
    """;
    ```
  - **Semicolon-Terminated (`$var = ... ;`)**: Natural multiline declaration spanning lines until the closing `;`:
    ```text
    $camera =
        shot on Hasselblad H6D-100c,
        85mm portrait prime lens,
        shallow depth of field;
    ```
- **Workflow & Environment Macros (`%macro%`)**: Automatically expands runtime parameters:
  - System timestamps: `%seed%`, `%date%` (`YYYY-MM-DD`), `%time%` (`HH:MM:SS`), `%timestamp%`, `%year%`, `%month%`, `%day%`.
  - Workflow parameters (inspected from active nodes): `%sampler%`, `%scheduler%`, `%steps%`, `%cfg%`, `%width%`, `%height%`.
- **Iterative Engine**: Backend expands dynamic choices, ranges, tuples, filters, and conditionals iteratively to prevent infinite loops while allowing deep prompt composition.

### 15. Pop-Out Studio Workstation (Floating / Fullscreen Immersion)
- **One-Click Pop Out (`⛶ Pop Out Studio`)**: Detaches the editor from the crowded canvas into a dedicated, floating prompt engineering studio window overlaid above ComfyUI.
- **Prompt Library Selector**: Directly integrated into the Pop-Out Studio toolbar:
  - **📁 Category Filter Dropdown**: Filter prompts by category or select `📁 All Categories`.
  - **📂 Prompt Selector Dropdown**: Browse and instantly load any saved prompt directly within the studio.
  - **`💾 Save` / `🔄 Update` / `🔃 Refresh`**: Full prompt lifecycle management without switching back to the node.
- **Dynamic Syntax Theme Switcher**: Change syntax themes (Modus Neon, Cyberpunk 2077, Dracula, Monokai Pro, Nord Frost, Solarized Dark, High Contrast, or Off) live inside the studio with instantaneous backdrop, text, caret, and container color updates.
- **Font Family Selector (Persistent)**: Choose your preferred typography from a curated font family dropdown:
  - `Monospace (Default)`: Clean modern system monospace stack (`ui-monospace`, `SFMono-Regular`, `Consolas`, `Monaco`).
  - `JetBrains Mono`: High-legibility developer font optimized for symbol alignment and tag scanning.
  - `Fira Code`: Modern programming font with ligature support.
  - `Consolas`: Classic Windows console font.
  - `Clean Sans (Inter / System)`: Highly readable proportional sans-serif interface font.
  - `Editorial Serif`: Literary serif typography (`Georgia`, `Cambria`, `Times New Roman`) for expressive prose writing.
  - `Readable / Dyslexic`: High-contrast, friendly rounded font (`Comic Neue`, `Chalkboard SE`).
  - *Persists automatically in browser storage across sessions and reloads.*
- **Font Size Steppers & Dynamic Zoom (Persistent)**:
  - **Size Dropdown**: Select exact font sizes from `11px` up to `28px` directly from the toolbar.
  - **`A-` and `A+` Stepper Buttons**: Instantly step font size down or up in $1\text{px}$ increments.
  - **Keyboard Shortcuts**: Press `Ctrl + Plus` (`Ctrl + =`) to zoom in, `Ctrl + Minus` to zoom out, or `Ctrl + 0` to reset to default $14\text{px}$.
  - **Mouse Wheel Zoom**: Hold `Ctrl` (or `Cmd` on Mac) and scroll your mouse wheel anywhere inside the positive or negative textareas for fluid real-time scaling.
  - *Pixel-perfect syntax alignment*: Both the text editing layer and the syntax highlighting layer scale in lockstep with zero offset drift.
- **100% Live 2-Way Connected**: Works directly with the underlying node on canvas. Any edits, tags, weight changes, or presets applied inside the Pop-Out Studio update the canvas node in real-time, preserving all execution wires, conditioning outputs, and workflow states.
- **Draggable & Resizable**: Grab the top header bar to move the studio anywhere on screen or drag it to a secondary monitor. Resize freely from any edge or corner with automatic geometry memory.
- **Fullscreen Immersion (`⇱`)**: Maximize into a full-viewport distraction-free writing environment ($100vw \times 100vh$).
- **Floating Mini-Dock (`—`)**: Minimize down to an unobtrusive floating pill in the corner of your screen when panning around your canvas or inspecting image outputs.
- **Direct Generation Queue (`🚀 Queue` / `Ctrl+Enter`)**: Queue ComfyUI generations straight from the studio without closing or switching back to the canvas.
- **Integrated Studio Ribbon**: Access all studio tools directly from the window toolbar: Tag Studio mode, Aesthetic Ribbon, Prosify, Tagify, Variation Grid, Ollama AI Enhance, LoRA Deck, Dedupe & Prettify, Color Spectrum, and Find & Replace.
- **Dock Back (`✕ Dock`)**: Seamlessly close the pop-out window and return to the standard node view.

### 16. Right-Click Ollama Selection Refiner (`🤖 Ollama: Refine Selection ▾`)
- **Surgical Prompt Inpainting with Local AI**: Instead of re-generating an entire prompt, select any word or phrase (or simply right-click with the cursor placed inside a word) in either the Pop-Out Studio or canvas textareas to invoke the local Ollama refinement engine.
- **Dark Glassmorphic Context Menu**: A dedicated floating menu appears displaying the target text snippet and 7 specialized transformation actions:
  - **`✨ Expand & Elaborate`**: Adds rich sensory textures, lighting nuances, and material details to the highlighted concept.
  - **`🔄 Visual Synonyms & Alternatives...`**: Queries Ollama for 5–8 vivid visual alternatives and opens an interactive floating picker modal:
    - **One-Click Replace**: Audition options and click any chip to replace the selection in-place.
    - **`⚄ Wrap All as Dynamic Choice`**: Packages the original term and all alternatives into a `{original|alt1|alt2}` block in one click.
    - **`📋 Copy to Clipboard`**: Copies any alternative without modifying the editor.
  - **`⚄ Wrap as Dynamic Choice`**: Instantly transforms the selection into a `{original|alt1|alt2}` permutation block directly in the prompt text.
  - **`⚡ Intensify & Elevate`**: Elevates mild descriptors into dramatic, evocative, high-impact phrasing.
  - **`✂️ Simplify & Compact`**: Prunes overly verbose descriptions down to crisp, essential keywords.
  - **`✍️ Prosify (Fluent Prose)`**: Converts tag-like selections into flowing natural language clauses tuned for FLUX.1 and SD3.
  - **`🏷️ Tagify (Keyword Tags)`**: Breaks descriptive phrases down into comma-separated visual tags tuned for SDXL and Pony Diffusion.
- **Prompt Style & Model Awareness**: System prompts adapt dynamically based on your active **Prompt Style** (`Tags` vs `Expressions`) and communicate directly with your selected local Ollama model.
- **Smart Word Snapping**: If no text is explicitly highlighted, right-clicking automatically snaps to the word or token under the cursor, eliminating tedious selection dragging.
- **Works Universally**: Fully supported across both Positive and Negative prompts in both the Pop-Out Studio and the standard ComfyUI canvas node.

### 17. Full Cross-Session Persistence Architecture
To prevent the frustration of resetting configurations whenever ComfyUI or the browser restarts, ModusFlow implements a unified multi-tier persistence pipeline (backed by `config.json`, browser `localStorage`, and native ComfyUI Settings):
- **Ollama AI Enhancement Model**: The selected local model is saved immediately to `config.json`, `localStorage`, and ComfyUI settings whenever chosen in either the status modal, settings panel, or pop-out studio. It will never reset to the first model in your list or default to another tag.
- **Default Prompt Style**: Global default prompt philosophy (`🏷️ Tags (SDXL / Pony)` vs `✍️ Expressions (Flux / SD3)`) persists across reboots and automatically initializes newly created Text Editor nodes.
- **Syntax Highlighting Theme**: Active theme choices persist across reboots, synchronizing across both canvas textareas and the Pop-Out Studio.
- **Pop-Out Studio Window Geometry**: Floating window position ($X, Y$) and custom dimensions (width & height) are saved to storage on every move, resize, and dock. When switching between monitors or smaller displays, the studio automatically clamps its coordinates to remain fully visible on screen. You can also re-center at any time by double-clicking the title bar, clicking the `⌖` header button, or right-clicking the canvas node $\rightarrow$ **🎯 Reset / Center Pop-Out Studio**.
- **Pop-Out Typography (Font Family & Size)**: Font choices (e.g. `JetBrains Mono`, `Fira Code`, `Inter`, `Editorial Serif`) and base font size ($11\text{px}-28\text{px}$) persist across sessions and browser tabs.
- **Prompt Category Filter**: The active category filter selected in the Pop-Out Studio persists across sessions so you don't have to re-navigate your preset library.
- **Automatic URL Sanitization**: Ollama server endpoints automatically clean up whitespace, accidental trailing slashes, and trailing dots on IP addresses (e.g., `192.168.x.x.:11434` $\rightarrow$ `192.168.x.x:11434`), preventing offline connection errors.

## Configuration

Set configuration in `config.json` or through the **⚙️ ModusFlow Studio & AI Settings** dialog:

```json
{
  "ollama_url": "http://127.0.0.1:11434",
  "ollama_model": "deepseek-r1:8b",
  "ollama_timeout": 120,
  "cloud_api_url": "https://openrouter.ai/api/v1",
  "cloud_api_key": "sk-...",
  "cloud_model": "deepseek/deepseek-chat",
  "civitai_api_key": "your_api_key",
  "prompts_save_directory": "C:/path/to/your/prompts",
  "prompt_style": "Tags (SDXL / Pony)",
  "syntax_theme": "Modus Neon (Default)",
  "popout_font_family": "Monospace",
  "popout_font_size": 14
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
| `.` *(after `$var`)* | **Object / Dict Properties** | `PROP` / `METH` | Typing `.` after a variable (e.g. `$woman.`) autocompletes dictionary keys from assigned wildcards or inline dictionaries, plus helpers (`keys`, `values`, `length`). Selecting inserts the property name. |

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
