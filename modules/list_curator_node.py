"""
ModusFlow List Curator Node

Provides interactive on-canvas curation, selection, and management of
wildcard and list files strictly stored in the saved_prompts/wildcards directory.
"""

import os
import random
import folder_paths


def _get_wildcard_dir():
    """Retrieve the strictly isolated saved_prompts/wildcards directory."""
    from ..config import settings, BASE_DIR
    prompts_dir = settings.get('prompts_save_directory', '').strip()
    if not prompts_dir:
        prompts_dir = os.path.join(BASE_DIR, 'saved_prompts')
    wc_dir = os.path.join(prompts_dir, 'wildcards')
    os.makedirs(wc_dir, exist_ok=True)
    return wc_dir


def _get_wildcard_files():
    """List all available .txt files in saved_prompts/wildcards."""
    wc_dir = _get_wildcard_dir()
    files = []
    if os.path.isdir(wc_dir):
        files = [
            os.path.splitext(f)[0]
            for f in sorted(os.listdir(wc_dir))
            if f.lower().endswith('.txt') and os.path.isfile(os.path.join(wc_dir, f))
        ]
    return files if files else ["--no wildcards found--"]


class ModusFlowListCurator:
    """
    Curate, view, edit, and sample from wildcard lists stored strictly in saved_prompts/wildcards.
    Supports random sampling, index-based sequential selection, or full-list concatenation.
    """
    @classmethod
    def INPUT_TYPES(cls):
        files = _get_wildcard_files()
        modes = [
            "Random (Seed Driven)",
            "Sequential (Index Driven)",
            "All Items (Comma Separated)",
            "All Items (Newline Separated)",
        ]

        return {
            "required": {
                "wildcard_list": (files, {"default": files[0]}),
                "mode": (modes, {"default": modes[0]}),
                "index": ("INT", {"default": 0, "min": 0, "max": 10000, "step": 1}),
                "seed": ("INT", {"default": 0, "min": 0, "max": 0xffffffffffffffff}),
                "custom_entries": ("STRING", {
                    "multiline": True,
                    "default": "",
                    "placeholder": "Optional: Add or override items here (one per line)...",
                }),
            },
            "optional": {
                "prefix": ("STRING", {"default": ""}),
                "suffix": ("STRING", {"default": ""}),
            }
        }

    CATEGORY = "ModusFlow/Utilities"
    RETURN_TYPES = ("STRING", "STRING", "INT")
    RETURN_NAMES = ("selected_item", "all_items", "item_count")
    FUNCTION = "curate"

    def curate(self, wildcard_list, mode, index, seed, custom_entries="", prefix="", suffix=""):
        items = []

        # 1. If custom_entries is provided, use it directly (allows on-canvas editing without immediate saving)
        if custom_entries and custom_entries.strip():
            for line in custom_entries.splitlines():
                cleaned = line.strip()
                if cleaned and not cleaned.startswith("#"):
                    items.append(cleaned)
        elif wildcard_list and wildcard_list != "--no wildcards found--":
            # 2. Fall back to loading from disk file in saved_prompts/wildcards/
            wc_dir = _get_wildcard_dir()
            clean_list_name = str(wildcard_list).strip()
            if clean_list_name.startswith("__") and clean_list_name.endswith("__") and len(clean_list_name) > 4:
                clean_list_name = clean_list_name[2:-2].strip()
            file_path = os.path.join(wc_dir, f"{clean_list_name}.txt")
            if os.path.isfile(file_path):
                try:
                    with open(file_path, "r", encoding="utf-8") as f:
                        for line in f:
                            cleaned = line.strip()
                            if cleaned and not cleaned.startswith("#"):
                                items.append(cleaned)
                except Exception as e:
                    print(f"[ModusFlow ListCurator] Error reading {file_path}: {e}")

        if not items:
            items = ["none"]

        count = len(items)

        # 3. Select item based on mode
        if mode == "Random (Seed Driven)":
            rng = random.Random(seed)
            selected = rng.choice(items)
        elif mode == "Sequential (Index Driven)":
            safe_idx = index % count
            selected = items[safe_idx]
        elif mode == "All Items (Comma Separated)":
            selected = ", ".join(items)
        elif mode == "All Items (Newline Separated)":
            selected = "\n".join(items)
        else:
            selected = items[0]

        # Apply optional prefix and suffix
        if prefix and prefix.strip():
            selected = f"{prefix.strip()} {selected}"
        if suffix and suffix.strip():
            selected = f"{selected} {suffix.strip()}"

        all_text = "\n".join(items)
        return (selected, all_text, count)
