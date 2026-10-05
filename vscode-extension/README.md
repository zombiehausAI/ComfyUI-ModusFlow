# ModusFlow Prompt Studio for Antigravity, VS Code & Cursor

A specialized IDE companion extension for [ComfyUI-ModusFlow](https://github.com/zombiehausAI/ComfyUI-ModusFlow). Edit prompts, inspect wildcards, preview LoRA metadata, and inpaint prompt text using your local Ollama AI model directly inside Antigravity, VS Code, Cursor, or Windsurf.

---

## Features

- **🎨 Full ModusFlow Syntax Highlighting**: Rich TextMate grammar and webview highlighter for dynamic choices (`{a|b|c}`), weighted odds (`{80::day|20::night}`), wildcards (`__lighting__`), variables (`$var`), CASE pattern-matching (`{case $style => "anime": 1 | default: 2}`), inline ternary conditionals (`{$style == "anime" ? vibrant : realistic}`), repeat loops (`{repeat 3 => detail, }`), for loops (`{for $item in $list => $item}`), keywords (`fn`, `def`, `repeat`, `for`, `in`, `as`, `case`, `@import`), filters (`| upper`, `| lower`), functions (`range`, `rand`, `.keys()`), attention weights (`(tag:1.2)`), and LoRA tags (`<lora:name:weight>`).
- **🌈 Document Color Provider & Natural Color Resolver**:
  - Live color decorators on `#hex` codes (`#e63946`) with built-in VS Code color picker.
  - Hover inspector displaying nearest diffusion-friendly natural color name (e.g. *"vibrant crimson red"*).
- **🤖 Ollama Selection Inpainting**:
  - Right-click any highlighted word or phrase to run surgical Ollama enhancements:
    - `✨ Expand & Elaborate`
    - `🔄 Visual Synonyms & Alternatives`
    - `⚄ Wrap as Dynamic Choice`
    - `⚡ Intensify & Elevate`
    - `✂️ Simplify & Compact`
    - `✍️ Prosify (Flux/SD3 Prose)`
    - `🏷️ Tagify (SDXL/Pony Tags)`
- **💡 Rich IntelliSense & Autocomplete**:
  - **Control Flow**: Type `{` to autocomplete CASE statements, for-loops, repeat loops, and dynamic choices.
  - **Imports & Macros**: Type `@` to autocomplete `@import(...)` files or macro calls.
  - **Pipes & Filters**: Type `|` to autocomplete text transformation filters (`upper`, `lower`, `title`, `trim`).
  - **Built-in Functions**: Autocomplete `range(start, end)` and `rand(min, max)`.
  - **Wildcards & Lists**: Type `__` to autocomplete from your ComfyUI wildcards library.
  - **LoRAs**: Type `<lora:` to autocomplete from your installed LoRAs with parameter placeholders.
  - **Macros**: Type `!cine`, `!photo`, `!anime`, or `!neg` and press `Tab` to expand prompt stacks.
- **🖼️ Hover Cards**:
  - Hover over `<lora:...>` tags to view Civitai thumbnail previews, creators, and trained trigger tags.
  - Hover over `$variable` tokens to see their assigned values.
- **⛶ Pop-Out Studio Cockpit Webview**:
  - Click the **`⛶`** icon in the editor title bar or run `ModusFlow: ⛶ Pop Out Studio Cockpit` to open a dual-pane studio tab matching the ComfyUI Pop-Out Text Editor.
  - Side-by-side **Positive** and **Negative** prompt editing areas.
  - **Interactive LoRA Deck**: Live chips for all `<lora:name:weight>` with `+`/`-` weight steppers, one-click trained trigger words insertion fetched live from ComfyUI, and instant removal.
  - **LoRA & Wildcard Search Modal**: Click `+ LoRA` or `+ Wildcard` in the toolbar to search and insert installed LoRAs and lists directly into your prompt.
  - **Negative Pedalboard Guard Rack**: One-click toggles for `✦ Quality`, `🚫 Anatomy`, `🎨 3D Guard`, and `💧 Watermark` that illuminate when active.
  - **Visual Aesthetic Ribbon**: 1-click drop-downs to inject curated Film Stocks (Kodak Portra, Cinestill), Optics & Lenses (85mm f/1.2, Anamorphic), Lighting Rigs, and Camera Systems.
  - **Prompt Style Switcher**: Toggle between `Tags (SDXL / Pony)` and `Expressions (Flux / SD3)` with live automatic conversion.
  - Direct **Save**, **Enhance with Ollama**, **Prettify / Dedupe**, and **🚀 Queue ComfyUI** buttons.
- **⚡ Native Prompt Tools & Keybindings**:
  - **Tag Weight Stepping (`Ctrl + Up` / `Ctrl + Down`)**: Step attention weights up or down by $\pm 0.05$ on selected tag or word under cursor (e.g. `tag` $\rightarrow$ `(tag:1.05)` $\rightarrow$ `(tag:1.10)`), unwrapping at 1.0.
  - **Prettify & Dedupe**: Strip duplicate tags, collapse duplicate commas, and normalize spacing.
  - **Toggle Explode / Collapse (`◫`)**: Switch between multi-line indented tags and inline comma-separated paragraphs.
  - **Style Converter**: Convert prompts bidirectionally between keyword tags and natural descriptive prose.
- **📊 Live Token & Word Counter**:
  - Real-time status bar counter tracking word count, estimated CLIP tokens, and 75-token chunk boundaries (`42w · 58 tok (58/75 Ch.1)`).
  - Immediate alert badge warning when unbalanced or unclosed parentheses are detected (`⚠️ unclosed ( )`).
- **📁 Activity Bar Studio Explorer**:
  - **Saved Prompts**: Browse saved prompts categorized by folder (`Portraits`, `Landscapes`, `Songs`, etc.).
  - **Installed LoRAs**: Browse all installed LoRAs from ComfyUI, view trigger words, and insert `<lora:name:0.8>` or triggers into the active editor with one click.
  - **Wildcards & Lists**: Browse, insert, and edit wildcard lists side-by-side.
  - **Connected Canvas Node**: Push and pull prompts directly to/from the active canvas node in ComfyUI.
  - Full virtual filesystem support (`modusflow:` scheme) with tab names and direct `Ctrl + S` saving back to ComfyUI.
- **🚀 One-Key Generation Queue**:
  - Press `Ctrl + Alt + Enter` (`Cmd + Alt + Enter` on macOS) to queue generation straight into ComfyUI.

---

## Installation

### From VSIX Package

1. In VS Code or Cursor, press `Ctrl + Shift + P` (or `Cmd + Shift + P`).
2. Type and select **`Extensions: Install from VSIX...`**.
3. Select `modusflow-prompt-studio-0.1.0.vsix` located in `ComfyUI-ModusFlow/vscode-extension/`.

Or via terminal:
```bash
code --install-extension modusflow-prompt-studio-0.1.0.vsix
```

---

## Configuration

In VS Code Settings (`Ctrl + ,`), search for `ModusFlow`:

- **`modusflow.comfyUrl`**: ComfyUI server address (default: `http://127.0.0.1:8188`).
- **`modusflow.defaultPromptStyle`**: Prompt philosophy (`Tags (SDXL / Pony)` vs `Expressions (Flux / SD3)`).
- **`modusflow.autoSyncOnType`**: Automatically stream prompt changes to canvas node.
