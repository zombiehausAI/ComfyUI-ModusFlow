# Function Editor

Curate, view, edit, and organize reusable prompt functions, loops, and macro logic directly on canvas with `@global` / `@private` scoping, dot-notation resolution, and direct chaining into the ModusFlow Text Editor.

## Overview

The **ModusFlow Function Editor** (`ModusFlowFunctionEditor`) provides an on-canvas development environment for defining, curating, and managing reusable prompt macros and functions. It keeps prompt logic clean and modular by decoupling complex function definitions, loops, and parameter expansions from your main prompts and lists.

Function libraries are saved strictly in `saved_prompts/functions/` as `.mf` or `.txt` files. They output a structured `FUNCTION_LIB` object that plugs directly into the `ModusFlow Text Editor`'s `function_lib` input socket, or chains across multiple Function Editors.

## Features

- **Scope Control via Decorators**:
  - **`@global`**: Function is exported globally to prompts. Can be invoked anywhere as `@func_name(...)` or via namespaced dot notation (`namespace.func_name(...)`).
  - **`@private`**: Function is private to its module namespace. Can **only** be invoked via namespaced dot notation (`namespace.func_name(...)`), preventing accidental global collisions.
- **Namespaced Dot-Notation Calls**: Define multiple function libraries (e.g. `camera`, `lighting`, `styles`) and call them with familiar dot notation directly in prompt text: `camera.portrait("85mm")`, `lighting.golden_hour()`.
- **Live Syntax Highlighting**: Real-time syntax highlighting for:
  - Scope decorators (`@global` badge, `@private` badge)
  - Function declarations (`fn name($arg1, $arg2) = { ... };`)
  - Parameters and variables (`$lens`, `$intensity`)
  - Loops and control keywords (`repeat`, `for`, `in`, `case`)
  - Dynamic choices and wildcards (`{all$$...}`, `{a|b}`, `__wildcard__`)
  - Comments (`//`, `/* ... */`, `#`)
- **Tab Indentation & Shortcuts**:
  - Press **`Tab`** to indent 4 spaces.
  - Press **`Shift + Tab`** to unindent.
  - Template buttons to quickly inject `@global` or `@private` function skeletons.
- **Function Library Chaining**: Daisy-chain multiple Function Editor nodes using the `chain_functions` input. Combine a `camera` library and a `lighting` library into a single pipe leading to the Text Editor.

## Inputs

### Required
- **function_file** (dropdown): Select an existing function library file from `saved_prompts/functions/`.
- **namespace** (STRING): The dot-notation module namespace (e.g. `camera`, `lighting`, `cinematography`).
- **script_code** (STRING, multiline): The function definitions and logic.

### Optional
- **chain_functions** (`FUNCTION_LIB`): An upstream `FUNCTION_LIB` connection to merge multiple function libraries together before feeding into the Text Editor.

## Outputs

- **function_lib** (`FUNCTION_LIB`): Parsed function registry containing namespaced and global macro definitions. Connect to `ModusFlow Text Editor` (`function_lib`) or another Function Editor (`chain_functions`).
- **raw_script** (STRING): Combined raw text of all chained scripts for inspection or downstream nodes.

## Function Syntax & Usage

### 1. Global Function (`@global`)
Exported to global prompt scope.

```text
@global
fn portrait($lens) = {
    close-up portrait shot on $lens, f/1.8 aperture, creamy bokeh, studio lighting
};
```

**Invoking in Text Editor prompt:**
```text
A woman in a leather jacket, @portrait("85mm"), high detail
```
*or via dot notation:*
```text
A woman in a leather jacket, camera.portrait("85mm"), high detail
```

---

### 2. Private Namespaced Function (`@private`)
Scoped strictly to its namespace. Cannot be called with bare `@helper(...)`.

```text
@private
fn rim_light($color) = {
    subtle neon rim lighting of $color reflecting on edges
};
```

**Invoking in Text Editor prompt:**
```text
cyberpunk alleyway, lighting.rim_light("cyan")
```

---

### 3. Nested Calls & Dynamic Logic
Functions can call other functions, use variables, dynamic choices, or wildcards inside their bodies:

```text
@global
fn cinematic($lens, $mood) = {
    cinematic wide shot on $lens, {moody|dramatic|ethereal} atmosphere, camera.color_grade($mood)
};

@private
fn color_grade($palette) = {
    color graded with $palette tones, 35mm film grain
};
```

---

### 4. Loops inside Functions
```text
@global
fn crowd($count, $archetype) = {
    repeat($count) {
        individual $archetype wearing {vintage|modern} clothing,
    }
};
```

## Canvas Controls

- **➕ Insert @global Fn**: Appends a pre-formatted `@global` function template at cursor position.
- **🔒 Insert @private Fn**: Appends a pre-formatted `@private` function template at cursor position.
- **💾 Save As New**: Prompts for a filename (e.g. `camera`) and saves to `saved_prompts/functions/<name>.mf`.
- **✏️ Update Selected**: Overwrites the currently selected file with the current canvas script.
- **🗑️ Delete Function**: Permanently removes the selected function file from disk.
- **🔄 Refresh Functions**: Scans `saved_prompts/functions/` for newly created or updated files.

## Workflow Example: Modular Prompting

1. Add a **ModusFlow Function Editor** node:
   - Set **namespace**: `camera`
   - Define your favorite camera setups:
     ```text
     @global
     fn close_up($lens) = {
         tight close-up shot on $lens, sharp focus, f/1.4, shallow depth of field
     };
     ```
2. Connect **function_lib** output to **ModusFlow Text Editor**'s **function_lib** input.
3. In your prompt, type:
   ```text
   A portrait of a mysterious traveler, @close_up("85mm lens"), dramatic golden hour lighting
   ```
4. The Text Editor expands the macro and passes the fully resolved prompt to CLIP/conditioning seamlessly!
