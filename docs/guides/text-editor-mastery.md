# ModusFlow Text Editor & Wildcard Mastery Guide

A comprehensive guide to all advanced features of **`ModusFlow Text Editor`** and **`ModusFlow List Curator`**: comment syntax, dynamic choices, tag shuffling, deterministic seeds, model weight translation (Chroma/Flux/T5 vs. SDXL/Pony), LoRA sanitization, strict `saved_prompts` wildcards, and prompt inspection.

---

## 1. Overview

[ModusFlow Text Editor](file:///c:/Users/donwo/source/ComfyUI-ModusFlow/modules/text_editor_node.py) is a centralized prompt engineering hub designed to eliminate the frustration of raw ComfyUI text boxes. It supports:
* Simultaneous positive and negative prompt editing with dedicated inputs/outputs.
* **Model-Aware Weight Adaptation:** Seamlessly bridge SDXL/Pony weight notation `(word:1.3)` into natural language emphasis or front-loaded priority for Chroma, Flux, and T5 architectures.
* **Developer Comments (`/* ... */`, `#`, `//`):** Leave notes, toggle tags, and annotate prompts cleanly without affecting generation.
* **Smart Sanitization:** Strips raw `<lora:...>` tags and normalizes broken punctuation and stray commas.
* **Dynamic Tag Shuffling (`{shuffle: ...}`):** Eliminate position bias by randomizing prompt tag order on each generation.
* **Dynamic Choices (`{a|b|c}`):** Inline nested selections with weighted probabilities.
* **Deterministic Seeding (`seed`):** Lock random variations to a seed or let them roll freely.
* **File-Based Wildcards (`__filename__`):** **Strictly isolated** to the `saved_prompts/` directory.
* **Visual List Curation:** Integrate [ModusFlow List Curator](file:///c:/Users/donwo/source/ComfyUI-ModusFlow/modules/list_curator_node.py) for interactive wildcard browsing directly on the canvas.

---

## 2. Model Weight Adaptation (`weight_mode`)

Different generative architectures interpret prompt syntax in radically different ways. The `weight_mode` dropdown allows you to write prompts using standard syntax while ModusFlow automatically adapts the text for your target model.

### The Architectural Problem: CLIP vs. T5 / DiT
* **CLIP Models (SD 1.5, SDXL, Pony, Illustrious):** CLIP text encoders support token weighting via parentheses, e.g. `(cinematic lighting:1.3)`. The backend multiplies the token embedding vectors directly.
* **T5-XXL / DiT Models (Chroma 1-HD, Flux, SD3):** T5 is a pure natural language translation model. It **does not parse parenthesis weights**. If you send `(cyberpunk:1.3)` to Chroma or Flux, the model literally reads parentheses, colons, and decimal points as text tokens, degrading prompt fidelity and injecting punctuation noise into the cross-attention layers.

### Available Weight Modes

```
┌────────────────────────────────────────────────────────────────────────┐
│                        weight_mode Selection                           │
├────────────────────────────────┬───────────────────────────────────────┤
│ Pass-Through (SDXL / Pony)     │ Keeps raw (tag:1.3) weights unchanged │
│ Translate for Chroma / Flux    │ Converts weights to natural language  │
│ Front-Load Priority (Chroma)   │ Amplifies & prepends to start of text │
│ Strip Weights (Clean Tags)     │ Removes all weights & parentheses     │
└────────────────────────────────┴───────────────────────────────────────┘
```

#### 1. `Pass-Through (SDXL / Pony)`
Leaves all parentheses, brackets, and numerical weights untouched.
* **Best For:** SDXL, Pony Diffusion V6, Illustrious, SD 1.5.
* **Input:** `1girl, (freckles:1.3), [blush:0.8]`
* **Output:** `1girl, (freckles:1.3), [blush:0.8]`

#### 2. `Translate for Chroma / Flux (Linguistic Emphasis)`
Automatically converts numerical weights into descriptive linguistic tokens that T5-XXL understands deeply.
* **Best For:** Chroma 1-HD, Flux.1 [dev], Flux.1 [schnell], SD 3.5.
* **Conversion Scale:**
  | Weight Range | Transformation | Example Input | Model Receives |
  |---|---|---|---|
  | **>= 1.35** | `strikingly intense {term}, emphasizing {term}` | `(neon rim light:1.4)` | `strikingly intense neon rim light, emphasizing neon rim light` |
  | **1.20 – 1.34** | `prominently featuring {term}, distinct {term}` | `(golden armor:1.25)` | `prominently featuring golden armor, distinct golden armor` |
  | **1.10 – 1.19** | `vivid {term}` | `(blue eyes:1.15)` | `vivid blue eyes` |
  | **0.91 – 1.09** | `{term}` (clean word) | `(katana:1.0)` | `katana` |
  | **0.76 – 0.90** | `subtle {term}` | `(lens flare:0.85)` | `subtle lens flare` |
  | **<= 0.75** | `faint, barely visible {term}` | `(fog:0.6)` | `faint, barely visible fog` |

#### 3. `Front-Load Priority (Chroma / Flux)`
In Diffusion Transformers (DiT), attention is highest at the beginning of the prompt sequence. This mode translates weights **and automatically moves high-priority concepts (weight >= 1.20) to the very front of the prompt string**.
* **Input:** `portrait of a warrior, forest background, (intricate glowing armor:1.3), 8k`
* **Output:** `prominently featuring intricate glowing armor, distinct intricate glowing armor, portrait of a warrior, forest background, 8k`

#### 4. `Strip Weights (Clean Tags)`
Strips all weights and parentheses completely, leaving clean natural words.
* **Input:** `(photorealistic:1.4), ((masterpiece)), [film grain:0.8]`
* **Output:** `photorealistic, masterpiece, film grain`

---

## 3. Dynamic Prompts & Tag Shuffling

ModusFlow features built-in evaluation for dynamic choices and shuffling without needing external custom nodes.

### Inline Choices (`{a|b|c}`)
Generate endless variations on each generation:
```text
portrait of a {cyberpunk|steampunk|fantasy|retro} heroine with {silver|neon blue|crimson} hair
```

* **Nested Choices:**
  ```text
  wearing a {flowing {crimson|emerald} silk gown|tactical {black|camo} combat armor}
  ```
* **Weighted Odds (`{weight::choice}`):**
  Directly set percentage or relative likelihoods without duplicating words:
  ```text
  heroine with {80::dark brown|15::platinum blonde|5::neon emerald} hair
  ```
  *(80% brown, 15% blonde, 5% rare emerald).*

### Pick-N & Range Selections (`{N$$...}` and `{min-max$$...}`)
Pick multiple unique items from a set without duplicates:
* **Fixed Count:**
  ```text
  1girl, {2$$freckles, blush, gold hoop earrings, choker, glasses, messy bun}
  ```
  *(Picks any 2 unique items from the list, comma-separated).*
* **Variable Range:**
  ```text
  streets of Neo-Tokyo, {1-3$$neon signs, steam vents, flying spinners, rain puddles, holographic ads}
  ```
  *(Randomly picks between 1 and 3 unique items on each queue).*

### Prompt Variables (Matched Consistency Across a Sentence)
Guarantee consistency between different parts of a sentence without hardcoding tags:
```text
$color = {emerald green|crimson red|midnight blue|pure gold};
portrait of an elven archer with $color eyes, wearing a matching $color hooded cloak
```
ModusFlow evaluates `$color` once and replaces it everywhere it appears in the prompt.

### Ternary If/Else Conditionals (`{$var==val?true:false}`)
Dynamically branch your prompt output based on evaluated variables or conditions:
```text
$color = {red|blue};
portrait of a warrior wearing {$color==red?crimson dragonscale armor:azure plate mail}
```
* **Equality (`==`)**: Evaluates true when the variable matches the target value (e.g., `{$color==red?man:woman}`). Strictly uses `==` for comparisons so as not to confuse with variable assignment (`$var = value;`).
* **Inequality (`!=`)**: Evaluates true when the variable does not match the target value (e.g., `{$weather!=rainy?clear sunny sky:stormy clouds}`).
* **Truthiness (`{$var?true:false}`)**: Evaluates true if `$var` is defined, non-empty, and not `false`, `0`, or `none` (e.g., `{$wearing_hat?black fedora:messy hair}`).
* **Optional False Branch**: If the colon and false branch are omitted, it cleanly evaluates to an empty string when false (e.g., `{$color==red?ruby brooch}`).
* **Nested Choices & Wildcards**: Branches fully support nested choice blocks and wildcards (e.g., `{$color==red?{crimson|ruby}:blue}`).

### CASE Statements (`{$var: pattern => result | * => default}`)
When branching across three or more options, **CASE statements** provide a cleaner, more readable alternative to nested if/else chains:
```text
$season = {spring|summer|autumn|winter};
portrait of an adventurer in a {$season:
    spring => blossoming meadow of cherry trees |
    summer => sun-drenched coastal beach |
    autumn => misty forest with golden maple leaves |
    winter => snow-covered mountain pass |
    * => lush emerald countryside
}, cinematic lighting
```
* **Arrow & Pipe Structure**: Branches are delimited by `|` (just like choice blocks) and map conditions to results with `=>`.
* **Exact Matching**: Checks variable value against exact strings (case-insensitive, e.g. `summer => sunflowers`).
* **Multi-Value Patterns**: Match any of several values using commas (e.g. `rain, storm, drizzle => rain slicker`).
* **Relational Operators**: Supports numerical and lexicographical comparisons (e.g. `>= 50 => grandmaster | * => apprentice`).
* **Fallback / Wildcard (`*`)**: Uses `*`, `default`, `_`, or `else` to catch unhandled values. If omitted, unmatched values evaluate to an empty string.
* **Nested Choices**: Individual branch outputs can contain choice blocks or wildcards (e.g. `spring => {cherry|peach} blossoms`).
* **Prefix Flexibility**: Both `{$var: ...}` and `{case $var: ...}` syntax forms are supported.


### Multi-Pick Wildcards (`__2$$wildcard__`)
Pick multiple random lines from a single wildcard `.txt` file:
```text
wearing __2$$accessories__, standing in __locations__
```
*(Selects 2 unique lines from `saved_prompts/wildcards/accessories.txt`).*

### Tag Shuffling (`{shuffle: ...}`)
Models often suffer from "token position bias" where tokens placed earlier dominate tokens placed later. Shuffling equal-priority aesthetic tags breaks bias:
```text
masterpiece, 1girl, {shuffle: volumetric lighting, cinematic atmosphere, 8k resolution, ray tracing, sharp focus}
```
Each generation, ModusFlow shuffles the items inside the `{shuffle: ...}` block into a random sequence.

### Negative Prompt Mute Toggle (`mute_negative`)
Models like Chroma 1-HD often generate richer, more cinematic lighting with zero negative prompt.
* Toggle **`mute_negative: True`** on the node to instantly bypass the negative prompt without deleting your text box notes.

### Deterministic Seed Control (`seed`)
ModusFlow Text Editor includes an optional **`seed`** widget/input and a **`seed`** passthrough output:
* **`seed = 0` (or disconnected):** Truly random on every queue.
* **`seed > 0` (or connected to KSampler seed):** All dynamic choices `{a|b|c}`, Pick-N `{2$$...}`, variables `$var`, `{shuffle: ...}`, and `__wildcards__` evaluate **deterministically**. Rerunning with the exact same seed produces the identical prompt every time.
* **Seed Passthrough Output:** The node outputs `seed` (`INT`), allowing you to wire it directly downstream to KSampler, ModusFlow LoRA Loader, or Save Image `%seed%` to keep seeds synchronized.

---

## 4. Developer Comments & Smart Sanitization

You can write comments, annotate prompts, and temporarily disable tags directly in your prompt text:

### Supported Comment Syntax
| Syntax | Example | What the Model Receives |
|---|---|---|
| **Block Comments** | `/* windblown hair, glowing runes, */` | *(Stripped completely)* |
| **Line Comments (`#` or `//`)** | `# camera angle test`<br>`// cinematic lighting` | *(Stripped completely)* |
| **Inline Comments** | `1girl, solo // character count`<br>`blue dress # outfit v2` | `1girl, solo, blue dress` |

### Smart Protections
1. **URL Protection:** `https://example.com/ref.png` or `http://...` is **never** cut off by `//`.
2. **Hex Color Protection:** `#ff00aa` or `#00ff00` is **never** stripped as a `#` comment.
3. **Punctuation Normalization:** Stray commas, leading commas, or duplicate commas (`, , ,`) created by stripping comments are cleanly normalized.
4. **LoRA Tag Cleaner:** Pasting prompts from web galleries that contain `<lora:name:1.0>` will have those tags automatically stripped from the text encoder output, preventing punctuation pollution while letting your dedicated ModusFlow LoRA loaders handle the weights.

### Keyboard Shortcuts
Inside the positive and negative text boxes:
* **Tag Weight Stepping ($\pm 0.05$):** `Ctrl + Up` / `Ctrl + Down` (or `Cmd + Up/Down` on macOS). Wraps selected text or word under cursor in `(tag:weight)` and steps in increments of 0.05. Stepping down to 1.0 unwraps to clean text.
* **Toggle Line Comment (`#`):** `Ctrl + /` (or `Cmd + /` on macOS)
* **Toggle Block Comment (`/* ... */`):** `Ctrl + Shift + /` or `Shift + Alt + A`

---

## 5. Wildcards (Strictly in `saved_prompts/`)

For large collections (clothing, hairstyles, camera lenses, or artist styles), ModusFlow uses `__name__` wildcards.

> [!IMPORTANT]
> **Strict Directory Isolation:**
> ModusFlow wildcards **only ever look inside your `saved_prompts/` folder** (specifically `saved_prompts/wildcards/` or `saved_prompts/`). They will never hunt through outside directories or unrelated ComfyUI paths.

### Creating Wildcard Lists
1. Place plain `.txt` files in:
   ```
   ComfyUI-ModusFlow/saved_prompts/wildcards/
   ```
2. Add entries (one per line, `#` comments allowed):
   ```text
   # hairstyles.txt
   long wavy ponytail
   sleek straight waist-length hair
   messy twin braids with ribbon ties
   short layered bob cut
   ```
3. Call it in your prompt with double underscores:
   ```text
   1girl, solo, portrait, __hairstyles__, wearing __outfits__
   ```

---

## 6. Visual List Curation with `ModusFlow List Curator`

Rather than editing text files outside ComfyUI, **`ModusFlow List Curator`** allows you to view, edit, save, update, and delete wildcard lists directly on your canvas.

### What Does the Curator Connect To?
`ModusFlow List Curator` outputs three values:
* `selected_item` (`STRING`): The single chosen entry (or formatted selection).
* `all_items` (`STRING`): All entries in the active list joined together.
* `item_count` (`INT`): Total number of lines in the list.

```
                               ┌───────────────────────────────────────────────┐
                               │             ModusFlow Text Editor             │
                               │  - curator_input     (fills {curator} in place)│
                               │  - curator_input_2   (fills {curator2} in place│
                               │  - positive_embedding (appends cleanly)      │
                               │  - positive_input     (injects / overrides)   │
                               └───────────────────────────────────────────────┘
                                       ▲
                                       │ selected_item
┌───────────────────────────┐          │
│   ModusFlow List Curator  ├──────────┼───────────────────────────────────────┐
│  - wildcard_list          │          │ selected_item                         │
│  - list entries textarea  │          ▼                                       ▼
│  - [Save / Update / Del]  ├► [ ModusFlow ShowText ]          [ Detailer Slot / Conditioning ]
└───────────────────────────┘  (visual canvas readout)         (inject traits into YOLO slot)
```

1. **Directly into `ModusFlow Text Editor` (`curator_input`): In-Place Replacement!**
   * **Connect:** `selected_item` $\rightarrow$ `curator_input`.
   * **In your prompt:** Place `{curator}` (or `{list}` or `{item}`) anywhere in your sentence:
     ```text
     masterpiece, 1girl, portrait, wearing {curator}, standing in a vibrant market, cinematic lighting
     ```
   * **Result:** The chosen list item is dropped **right into the middle of the prompt** in that exact spot!
   * **Fallback:** If you do not include `{curator}` in your text, it safely appends to the end of the positive prompt.
2. **Multiple Curators (`curator_input_2`):**
   * Connect a second curator into `curator_input_2` to fill the `{curator2}` placeholder in place.
3. **Dedicated Embedding Input (`positive_embedding`):**
   * Stays completely clean and independent for actual textual inversion tokens or LoRA trigger words.
4. **Directly into `ModusFlow Text Editor` (`positive_input`):**
   * Overrides or dynamically supplies the entire positive prompt from a curated template list.
5. **Directly into `ModusFlow ShowText`:**
   * Inspect the exact picked item on each seed generation right beside your sampler.
6. **Directly into `ModusFlow Detailer Slot`:**
   * Feed random or sequential eye colors, expressions, or clothing details straight into a specific YOLO detailer pass.

---

### On-Canvas Save, Update & Delete Controls

Inside the node UI:
* **Automatic File Loading:** Selecting any file from the `wildcard_list` dropdown automatically loads its lines into the on-canvas textarea.
* **💾 Save As New:** Prompts for a new list name (without extension) and saves the textarea contents to `saved_prompts/wildcards/<name>.txt`.
* **✏️ Update Selected:** Overwrites the currently selected wildcard `.txt` file with whatever edits you made in the textarea.
* **🗑️ Delete List:** Permanently removes the selected `.txt` file from disk (with a safety confirmation prompt).
* **🔄 Refresh Lists:** Reloads the dropdown options if you added files externally.

### Curation Modes:
* **Random (Seed Driven):** Picks a random line per generation (repeatable when `seed` is set).
* **Sequential (Index Driven):** Cycles through lines sequentially using an `index` integer (ideal for batching or animations).
* **All Items (Comma Separated):** Joins all items in the list into a single comma-delimited string.
* **All Items (Newline Separated):** Formats items as a multiline block.
* **Prefix / Suffix:** Prepend (e.g. `"wearing a"`) or append (e.g. `"in daylight"`) to every picked item automatically.

---

## 7. Saving & Loading Prompt Libraries

`ModusFlow Text Editor` includes a persistent prompt library:
1. Enter your positive and negative prompts.
2. In **`prompt_category`**, enter a category (e.g. `Characters`, `Landscapes`, `Portraits`).
3. Click **💾 Save Prompt** and enter a prompt title.
4. To reload later: Filter by category with **`category_filter`**, then select from **`saved_prompt`**.
5. Prompts are stored as JSON files inside `saved_prompts/` and are fully preserved across ComfyUI updates.

---

## 8. Inspecting Resolved Prompts

Because dynamic prompts, wildcards, and weight translations transform your text before sending it to the model, you can inspect the exact final string:

* Connect the `positive` output from `ModusFlow Text Editor` into **`ModusFlow ShowText`**.
* The node will display the fully resolved, sanitized string right on the canvas.

---

## 9. Modular Prompt Stacking with `ModusFlow Prompt Mixer`

For ultimate modularity, **`ModusFlow Prompt Mixer`** allows assembling prompts from independent, switchable layers:

```
[ ModusFlow Text Editor ] ──── Subject ────► ┌───────────────────────────┐
[ ModusFlow List Curator ] ─── Outfit ─────► │   ModusFlow Prompt Mixer  ├─► KSampler
[ Wildcard File / Text ] ──── Setting ────► │  - Per-slot bypass toggle │
[ Camera / Mood Preset ] ──── Lighting ───► │  - Custom auto-prefixes   │
                                             └───────────────────────────┘
```

### Features:
* **5 Modular Layers:**
  1. `Slot 1`: Primary Subject (e.g. `1girl, solo, portrait`)
  2. `Slot 2`: Outfit & Accessories (Prefix: `"wearing"`)
  3. `Slot 3`: Environment & Setting (Prefix: `"standing in"`)
  4. `Slot 4`: Lighting & Atmosphere (Prefix: `"illuminated by"`)
  5. `Slot 5`: Camera, Aesthetics & Quality (Prefix: `"captured on"`)
* **Independent Bypass Toggles (`slotN_enabled`):** Turn backgrounds, lighting styles, or clothing on and off instantly without deleting text.
* **Auto-Prefix Protection:** Prefixes (like `"wearing"`) are automatically prepended if not already present, avoiding duplicate words.
* **Pipe-Aware:** Connects directly into the ModusFlow pipe or outputs standalone strings.
