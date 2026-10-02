# List Curator

Interactive on-canvas wildcard viewing, editing, saving, updating, and deleting with live syntax highlighting, comment shortcuts, and intelligent autocomplete.

## Overview

The **ModusFlow List Curator** (`ModusFlowListCurator`) provides a full visual management interface for your wildcard and list files directly inside ComfyUI. Instead of opening an external text editor and hunting down `.txt` files in filesystem folders, you can browse, edit, curate, and save wildcard lists right on your canvas.

Wildcard and list files are strictly stored in the `saved_prompts/wildcards/` directory.

## Features

- **On-Canvas Wildcard Editor**: Select any list from the dropdown, edit its lines in place, or create brand-new lists with one click.
- **Live Syntax Highlighting**: Real-time syntax color highlighting matching the Text Editor's active theme:
  - **Comments** (`# comment`, `// comment`, `/* block */`)
  - **Dynamic choices** (`{red|green|blue}`, `{2$$options}`, `{80::day|20::night}`)
  - **Tag shuffles** (`{shuffle: a, b, c}`)
  - **Nested wildcards** (`__nested_list__`)
  - **Attention weights** (`(vibrant:1.2)`)
  - **Prompt variables** (`$style`, `$color`)
  - **LoRA tags** (`<lora:model:1.0>`)
- **Live Item & Line Counter Badge**: Real-time counter badge at the bottom-right showing active entries vs. total lines (e.g. `14 items (18 lines)`).
- **Line Comment Toggle Shortcut**: Press **`Ctrl + /`** (or **`Cmd + /`** on macOS) to instantly toggle `# ` comment prefixes on any selected line(s).
- **Intelligent Autocomplete**:
  - `__` triggers wildcard list suggestions
  - `<lora:` or `<l` triggers LoRA model suggestions
  - `$` triggers prompt variable suggestions
  - `%` triggers system variable suggestions
  - `{c` triggers curator placeholder suggestions
- **Auto-Sanitized Names**: Entering names with `__` out of habit (e.g. `__hair_colors__`) automatically strips the underscores for clean filenames while reminding you of the prompt syntax (`__hair_colors__`).
- **Flexible Sampling**: Deterministic or seed-driven random selection, sequential stepping, or all-items concatenation.

## Inputs

### Required
- **wildcard_list** (dropdown): Select an existing wildcard list from `saved_prompts/wildcards/`.
- **custom_entries** (STRING, multiline): Textarea containing entries (one per line). Editing here allows live updates or new list creation.
- **mode** (dropdown):
  - `Random (Seed-Driven)`: Picks a random non-comment entry based on the seed.
  - `Sequential`: Steps through entries sequentially using the seed (`seed % count`).
  - `All Items (Comma-Separated)`: Joins all active lines into a single comma-separated list.
  - `All Items (Newline-Separated)`: Joins all active lines with linebreaks.
- **seed** (INT): Seed controlling deterministic random/sequential selection.

## Outputs

- **selected_item** (STRING): The single chosen entry (or formatted selection). Connect to `ModusFlow Text Editor` (`curator_input`), `ModusFlow ShowText`, or a detailer slot.
- **all_items** (STRING): All non-comment entries in the active list.
- **item_count** (INT): Total number of active entries in the list.

## Canvas Controls

- **💾 Save As New**: Prompts for a filename and saves the textarea contents to `saved_prompts/wildcards/<name>.txt`.
- **✏️ Update Selected**: Overwrites the currently selected list file with the current lines.
- **🗑️ Delete List**: Permanently deletes the selected list file.
- **🔄 Refresh Lists**: Reloads list files from disk and updates the dropdown.

## Tips & Best Practices

1. **In-Place Prompt Insertion**: Connect `selected_item` into `curator_input` on `ModusFlow Text Editor`. Inside your prompt, write `{curator}` wherever you want the list item to appear (e.g. `portrait of a woman with {curator}, 8k`).
2. **Commented Variations**: Use `#` to comment out items you want to temporarily disable without deleting them from the list.
