import os
import sys
import re
import torch
from nodes import CLIPTextEncode

class ModusFlowTextEditor:
    """
    A resizable text editor node with save/load functionality.
    Allows editing positive and negative prompts with both input and output connections.
    Provides ability to save and load text prompts from a configurable directory as JSON files.
    """

    @classmethod
    def INPUT_TYPES(cls):
        # Get saved prompts for dropdown
        saved_prompts = cls.get_saved_prompts()
        weight_modes = [
            "Pass-Through (SDXL / Pony)",
            "Translate for Chroma / Flux (Linguistic Emphasis)",
            "Front-Load Priority (Chroma / Flux)",
            "Strip Weights (Clean Tags)",
        ]

        return {
            "required": {
                "positive": ("STRING", {"default": "", "multiline": True}),
                "negative": ("STRING", {"default": "", "multiline": True}),
                "saved_prompt": (saved_prompts, {"default": saved_prompts[0] if saved_prompts else ""}),
                "weight_mode": (weight_modes, {"default": weight_modes[0]}),
            },
            "optional": {
                "seed": ("INT", {"default": 0, "min": 0, "max": 0xffffffffffffffff}),
                "positive_input": ("STRING", {"forceInput": True}),
                "negative_input": ("STRING", {"forceInput": True}),
                "positive_embedding": ("STRING", {"forceInput": True}),
                "negative_embedding": ("STRING", {"forceInput": True}),
            },
            "hidden": {
                "unique_id": "UNIQUE_ID",
                "extra_pnginfo": "EXTRA_PNGINFO",
            },
        }

    @classmethod
    def get_saved_prompts(cls):
        """Get list of saved prompts from the configured directory and subdirectories."""
        try:
            from ..config import settings, BASE_DIR
            prompts_dir = settings.get('prompts_save_directory', '').strip()
            if not prompts_dir:
                prompts_dir = os.path.join(BASE_DIR, 'saved_prompts')

            seen = set()
            files = []
            scan_dirs = [os.path.join(prompts_dir, 'prompts'), prompts_dir, os.path.join(prompts_dir, 'songs')]
            for d in scan_dirs:
                if os.path.isdir(d):
                    for f in sorted(os.listdir(d)):
                        if f.endswith('.json') and f not in seen:
                            seen.add(f)
                            files.append(f)
            if files:
                files.sort()
                return ["--select prompt--"] + files
        except Exception as e:
            print(f"[ModusFlow TextEditor] Error loading prompts list: {e}")

        return ["--no prompts found--"]

    RETURN_TYPES = ("STRING", "STRING",)
    RETURN_NAMES = ("positive", "negative",)
    FUNCTION = "process_text"
    OUTPUT_NODE = False
    CATEGORY = "ModusFlow/Utilities"

    @staticmethod
    def filter_comments(text: str) -> str:
        """Strip block comments (/* ... */) and line/inline comments (#, //), normalizing punctuation."""
        if not text or not isinstance(text, str):
            return ""

        # 1. Strip block comments /* ... */ across single or multiple lines
        text = re.sub(r'/\*[\s\S]*?\*/', '', text)

        # 2. Strip full line comments starting with # or // (ignoring leading whitespace)
        text = re.sub(r'^\s*(?:#|//).*$', '', text, flags=re.MULTILINE)

        # 3. Strip inline // comments (ensuring not to match URLs like http:// or https://)
        text = re.sub(r'(?<!https:)(?<!http:)\s+//.*$', '', text, flags=re.MULTILINE)

        # 4. Strip inline # comments (preceded by whitespace and followed by space)
        # Keeps hex color codes like #ff0000 intact
        text = re.sub(r'\s+#\s+.*$', '', text, flags=re.MULTILINE)

        # 5. Clean up duplicate commas and whitespace
        text = re.sub(r',\s*,+', ', ', text)
        text = re.sub(r'[ \t]+', ' ', text)

        lines = []
        for line in text.splitlines():
            line = line.strip()
            line = re.sub(r'^,\s*', '', line)
            line = re.sub(r',\s*,+', ', ', line)
            if line and line != ',':
                lines.append(line)

        return "\n".join(lines).strip()

    @staticmethod
    def strip_lora_tags(text: str) -> str:
        """Strip <lora:filename:1.0> or <lora:filename> so raw angle brackets do not pollute prompts."""
        if not text or not isinstance(text, str):
            return ""
        return re.sub(r'<lora:[^>]+>', '', text)

    @staticmethod
    def resolve_dynamic_prompts(text: str, seed: int = None) -> str:
        """Resolve {option1|option2}, {shuffle: a, b}, and __wildcard__ files strictly in saved_prompts."""
        if not text or not isinstance(text, str):
            return ""

        import random
        rng = random.Random(seed) if seed is not None and seed != 0 else random.Random()

        # 1. Resolve {shuffle: a, b, c}
        def replace_shuffle(match):
            items = [x.strip() for x in match.group(1).split(',') if x.strip()]
            rng.shuffle(items)
            return ", ".join(items)

        text = re.sub(r'\{shuffle:\s*([^{}]+)\}', replace_shuffle, text, flags=re.IGNORECASE)

        # 2. Resolve {a|b|c} choices recursively
        def replace_choice(match):
            options = match.group(1).split('|')
            return rng.choice(options)

        pattern = r'\{([^{}]+)\}'
        for _ in range(10): # Max 10 passes for nested {a|{b|c}}
            if not re.search(pattern, text):
                break
            text = re.sub(pattern, replace_choice, text)

        # 3. Resolve __wildcard__ file references (strictly within saved_prompts)
        def replace_wildcard(match):
            wc_name = match.group(1).strip()
            try:
                from ..config import settings, BASE_DIR
                prompts_dir = settings.get('prompts_save_directory', '').strip()
                if not prompts_dir:
                    prompts_dir = os.path.join(BASE_DIR, 'saved_prompts')

                candidates = [
                    os.path.join(prompts_dir, 'wildcards', f"{wc_name}.txt"),
                    os.path.join(prompts_dir, f"{wc_name}.txt"),
                ]
                for c in candidates:
                    if os.path.isfile(c):
                        with open(c, 'r', encoding='utf-8') as f:
                            lines = [l.strip() for l in f if l.strip() and not l.startswith('#')]
                        if lines:
                            return rng.choice(lines)
            except Exception:
                pass
            return match.group(0)

        text = re.sub(r'__([a-zA-Z0-9_\-]+)__', replace_wildcard, text)
        return text

    @staticmethod
    def translate_weights(text: str, weight_mode: str) -> str:
        """
        Manipulate weighted tokens (word:1.3), ((word)), [word] for target models:
        - Pass-Through: keep as-is for SDXL/Pony.
        - Translate: convert weights to natural language emphasis (T5/Chroma/Flux).
        - Front-Load: convert and pull high-priority tokens to the start of the prompt.
        - Strip Weights: remove weights and keep clean words.
        """
        if not text or not isinstance(text, str) or weight_mode.startswith("Pass-Through"):
            return text

        front_items = []

        # 1. Match (text:weight)
        def replace_weight(match):
            term = match.group(1).strip()
            w_str = match.group(2).strip()
            try:
                w = float(w_str)
            except ValueError:
                return match.group(0)

            if weight_mode.startswith("Strip"):
                return term

            # Linguistic emphasis conversion for Chroma / Flux
            if w >= 1.35:
                transformed = f"strikingly intense {term}, emphasizing {term}"
            elif w >= 1.20:
                transformed = f"prominently featuring {term}, distinct {term}"
            elif w >= 1.10:
                transformed = f"vivid {term}"
            elif w <= 0.75:
                transformed = f"faint, barely visible {term}"
            elif w <= 0.90:
                transformed = f"subtle {term}"
            else:
                transformed = term

            if weight_mode.startswith("Front-Load") and w >= 1.20:
                front_items.append(transformed)
                return "" # Removed from mid-prompt, will be prepended
            return transformed

        pattern_weight = r'\(([^():]+):([0-9.]+)\)'
        text = re.sub(pattern_weight, replace_weight, text)

        # 2. Match classic parentheses ((text)) without weight
        if weight_mode.startswith("Strip") or "Chroma" in weight_mode or "Flux" in weight_mode:
            text = re.sub(r'\(([a-zA-Z0-9_\s\-]+)\)', r'\1', text)

        # Clean duplicate commas and spaces
        text = re.sub(r',\s*,+', ', ', text)
        text = re.sub(r'^[,\s]+', '', text)

        # 3. If Front-Load, prepend front_items to the prompt
        if front_items:
            front_str = ", ".join(front_items)
            text = f"{front_str}, {text}".strip(", ")

        return text

    def process_text(self, positive, negative, saved_prompt, weight_mode="Pass-Through (SDXL / Pony)",
                     seed=None, positive_input=None, negative_input=None, positive_embedding=None,
                     negative_embedding=None, unique_id=None, extra_pnginfo=None):
        """Process positive and negative text inputs and return them as outputs."""
        # If connected inputs are provided, they take precedence over widget values
        raw_positive = positive_input if positive_input is not None else positive
        raw_negative = negative_input if negative_input is not None else negative

        # 1. Strip raw LoRA tags
        clean_positive = self.strip_lora_tags(raw_positive)
        clean_negative = self.strip_lora_tags(raw_negative)

        # 2. Filter out comments
        no_comments_positive = self.filter_comments(clean_positive)
        no_comments_negative = self.filter_comments(clean_negative)

        # 3. Resolve dynamic wildcards, choices, and tag shuffles (seed-driven)
        resolved_positive = self.resolve_dynamic_prompts(no_comments_positive, seed=seed)
        resolved_negative = self.resolve_dynamic_prompts(no_comments_negative, seed=seed)

        # 4. Apply weight translation / front-loading
        output_positive = self.translate_weights(resolved_positive, weight_mode)
        output_negative = self.translate_weights(resolved_negative, weight_mode)

        # 5. Append embeddings to respective outputs
        if positive_embedding is not None and positive_embedding.strip():
            output_positive = f"{output_positive}, {positive_embedding}".strip(", ")
        if negative_embedding is not None and negative_embedding.strip():
            output_negative = f"{output_negative}, {negative_embedding}".strip(", ")

        # Update the node's widget values in the workflow metadata if available
        if unique_id is not None and extra_pnginfo is not None:
            if isinstance(extra_pnginfo, dict) and "workflow" in extra_pnginfo:
                workflow = extra_pnginfo["workflow"]
                node = next(
                    (x for x in workflow["nodes"] if str(x["id"]) == str(unique_id)),
                    None,
                )
                if node:
                    actual_seed = seed if seed is not None else 0
                    node["widgets_values"] = [positive, negative, saved_prompt, weight_mode, actual_seed]

        return (output_positive, output_negative,)
