import os
import sys
import re
import time
import random
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
                "seed_action": (["fixed", "randomize", "increment", "decrement"], {"default": "fixed"}),
                "mute_negative": ("BOOLEAN", {"default": False}),
                "clip": ("CLIP",),
                "pipe": ("PIPE",),
                "positive_input": ("STRING", {"forceInput": True}),
                "negative_input": ("STRING", {"forceInput": True}),
                "curator_input": ("STRING", {"forceInput": True}),
                "curator_input_2": ("STRING", {"forceInput": True}),
                "curator_negative": ("STRING", {"forceInput": True}),
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

    RETURN_TYPES = ("STRING", "STRING", "INT", "CONDITIONING", "CONDITIONING", "PIPE",)
    RETURN_NAMES = ("positive", "negative", "seed", "positive_cond", "negative_cond", "pipe",)
    FUNCTION = "process_text"
    OUTPUT_NODE = False
    CATEGORY = "ModusFlow/Utilities"

    @classmethod
    def IS_CHANGED(cls, seed=0, seed_action="fixed", **kwargs):
        if seed_action in ("randomize", "increment", "decrement"):
            return time.time()
        return seed

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
        """
        Resolve:
        - Variables ($color = {red|blue}; ... $color)
        - Pick-N & Range choices ({2$$a|b|c}, {1-3$$a|b|c})
        - Weighted choices ({80::blue | 20::red})
        - Shuffles ({shuffle: a, b, c})
        - Standard choices ({a|b|c})
        - Wildcards (__name__, __2$$name__, __1-3$$name__) strictly in saved_prompts/wildcards/
        """
        if not text or not isinstance(text, str):
            return ""

        import random
        rng = random.Random(seed) if seed is not None and seed != 0 else random.Random()

        # Helper: parse count spec "2" or "1-3"
        def parse_count(spec, total):
            if not spec or total <= 0:
                return 1
            if '-' in spec:
                try:
                    low, high = map(int, spec.split('-'))
                    low = max(1, min(low, total))
                    high = max(low, min(high, total))
                    return rng.randint(low, high)
                except Exception:
                    return 1
            try:
                k = int(spec)
                return max(1, min(k, total))
            except Exception:
                return 1

        # Helper: sample k items without replacement respecting weights if given
        def sample_items(options_with_weights, k):
            if not options_with_weights:
                return []
            k = max(1, min(k, len(options_with_weights)))
            pool = list(options_with_weights)
            picked = []
            for _ in range(k):
                if not pool:
                    break
                weights = [w for _, w in pool]
                total_w = sum(weights)
                if total_w <= 0:
                    weights = [1.0] * len(pool)
                chosen = rng.choices(pool, weights=weights, k=1)[0]
                picked.append(chosen[0])
                pool.remove(chosen)
            return picked

        # 1. Resolve Variables: $varname = expression; or $varname = expression\n
        var_pattern = r'^\s*\$([a-zA-Z0-9_]+)\s*=\s*([^;\n]+)[;\n]?'
        variables = {}
        cleaned_lines = []
        for line in text.splitlines():
            m = re.match(var_pattern, line)
            if m:
                var_name = m.group(1).strip()
                var_expr = m.group(2).strip()
                # Evaluate expression if it contains choices or wildcards
                eval_val = ModusFlowTextEditor.resolve_dynamic_prompts(var_expr, seed=seed)
                variables[var_name] = eval_val
            else:
                cleaned_lines.append(line)
        text = "\n".join(cleaned_lines)

        # Substitute defined variables everywhere ($varname)
        for var_name, var_val in variables.items():
            text = re.sub(rf'\${var_name}\b', var_val, text)

        # 2. Resolve {shuffle: a, b, c}
        def replace_shuffle(match):
            items = [x.strip() for x in match.group(1).split(',') if x.strip()]
            rng.shuffle(items)
            return ", ".join(items)

        text = re.sub(r'\{shuffle:\s*([^{}]+)\}', replace_shuffle, text, flags=re.IGNORECASE)

        # 3. Resolve Pick-N, Weighted, and standard choices:
        # e.g. {2$$a|b|c}, {1-3$$a|b|c}, {80::blue|20::red}, {a|b|c}
        def replace_choice(match):
            content = match.group(1).strip()
            count_spec = None
            if '$$' in content:
                parts = content.split('$$', 1)
                count_spec = parts[0].strip()
                content = parts[1].strip()

            if '|' in content:
                raw_options = content.split('|')
            elif count_spec and ',' in content:
                raw_options = content.split(',')
            else:
                raw_options = [content]

            options_with_weights = []
            for opt in raw_options:
                opt = opt.strip()
                if not opt:
                    continue
                wm = re.match(r'^([0-9.]+)::(.*)$', opt)
                if wm:
                    try:
                        w = float(wm.group(1))
                        item = wm.group(2).strip()
                        options_with_weights.append((item, max(0.001, w)))
                    except Exception:
                        options_with_weights.append((opt, 1.0))
                else:
                    options_with_weights.append((opt, 1.0))

            if not options_with_weights:
                return ""

            k = parse_count(count_spec, len(options_with_weights)) if count_spec else 1
            picked = sample_items(options_with_weights, k)
            return ", ".join(picked)

        pattern = r'\{([^{}]+)\}'
        for _ in range(10): # Max 10 passes for nested {a|{b|c}}
            if not re.search(pattern, text):
                break
            text = re.sub(pattern, replace_choice, text)

        # 4. Resolve __wildcard__ and __N$$wildcard__ file references (strictly within saved_prompts)
        def replace_wildcard(match):
            count_spec = match.group(1)
            wc_name = match.group(2).strip()
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
                            k = parse_count(count_spec, len(lines)) if count_spec else 1
                            lines_with_weights = [(line, 1.0) for line in lines]
                            picked = sample_items(lines_with_weights, k)
                            return ", ".join(picked)
            except Exception:
                pass
            return match.group(0)

        # Matches __wildcard__ OR __2$$wildcard__ OR __1-3$$wildcard__
        text = re.sub(r'__(?:([0-9]+(?:-[0-9]+)?)\$\$)?([a-zA-Z0-9_\-]+)__', replace_wildcard, text)
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
                     seed=None, seed_action="fixed", mute_negative=False,
                     clip=None, pipe=None,
                     positive_input=None, negative_input=None,
                     curator_input=None, curator_input_2=None, curator_negative=None,
                     positive_embedding=None, negative_embedding=None,
                     unique_id=None, extra_pnginfo=None):
        """Process positive and negative text inputs, resolve wildcards/weights, and return text, seed, conditioning, and pipe."""
        # 1. Determine actual seed based on seed_action
        try:
            base_seed = int(seed) if seed is not None else 0
        except (ValueError, TypeError):
            base_seed = 0

        if seed_action == "randomize":
            actual_seed = random.randint(0, 0xffffffffffffffff)
        elif seed_action == "increment":
            actual_seed = (base_seed + 1) & 0xffffffffffffffff
        elif seed_action == "decrement":
            actual_seed = (base_seed - 1) & 0xffffffffffffffff if base_seed > 0 else 0
        else:
            actual_seed = base_seed

        # If connected inputs are provided, they take precedence over widget values
        raw_positive = positive_input if positive_input is not None else positive
        raw_negative = negative_input if negative_input is not None else negative

        # 2. Strip raw LoRA tags
        clean_positive = self.strip_lora_tags(raw_positive)
        clean_negative = self.strip_lora_tags(raw_negative)

        # 3. In-place placeholder injection for connected List Curators
        if curator_input is not None and str(curator_input).strip():
            c1_str = str(curator_input).strip()
            p1 = r'\{(?:curator|curator1|curator_1|list|item)\}'
            if re.search(p1, clean_positive, flags=re.IGNORECASE):
                clean_positive = re.sub(p1, c1_str, clean_positive, flags=re.IGNORECASE)
            else:
                clean_positive = f"{clean_positive}, {c1_str}".strip(", ")

        if curator_input_2 is not None and str(curator_input_2).strip():
            c2_str = str(curator_input_2).strip()
            p2 = r'\{(?:curator2|curator_2|list2|item2)\}'
            if re.search(p2, clean_positive, flags=re.IGNORECASE):
                clean_positive = re.sub(p2, c2_str, clean_positive, flags=re.IGNORECASE)
            else:
                clean_positive = f"{clean_positive}, {c2_str}".strip(", ")

        if curator_negative is not None and str(curator_negative).strip():
            cn_str = str(curator_negative).strip()
            pn = r'\{(?:curator|curator_negative|list|item)\}'
            if re.search(pn, clean_negative, flags=re.IGNORECASE):
                clean_negative = re.sub(pn, cn_str, clean_negative, flags=re.IGNORECASE)
            else:
                clean_negative = f"{clean_negative}, {cn_str}".strip(", ")

        # 4. Filter out comments
        no_comments_positive = self.filter_comments(clean_positive)
        no_comments_negative = self.filter_comments(clean_negative)

        # 5. Resolve dynamic wildcards, choices, and tag shuffles (seed-driven)
        resolved_positive = self.resolve_dynamic_prompts(no_comments_positive, seed=actual_seed)
        resolved_negative = self.resolve_dynamic_prompts(no_comments_negative, seed=actual_seed)

        # 6. Apply weight translation / front-loading
        output_positive = self.translate_weights(resolved_positive, weight_mode)
        output_negative = self.translate_weights(resolved_negative, weight_mode)

        # 7. Append embeddings to respective outputs
        if positive_embedding is not None and positive_embedding.strip():
            output_positive = f"{output_positive}, {positive_embedding}".strip(", ")
        if negative_embedding is not None and negative_embedding.strip():
            output_negative = f"{output_negative}, {negative_embedding}".strip(", ")

        # 8. Apply mute_negative toggle
        if mute_negative:
            output_negative = ""

        # 9. Direct CLIP conditioning & Pipe generation
        pos_cond = []
        neg_cond = []
        active_clip = clip
        model = None
        vae = None

        if pipe is not None and isinstance(pipe, (tuple, list)):
            model = pipe[0] if len(pipe) > 0 else None
            if active_clip is None and len(pipe) > 1:
                active_clip = pipe[1]
            vae = pipe[2] if len(pipe) > 2 else None

        if active_clip is not None:
            try:
                encoder = CLIPTextEncode()
                pos_cond = encoder.encode(active_clip, output_positive)[0]
                neg_cond = encoder.encode(active_clip, output_negative)[0]
            except Exception as e:
                print(f"[ModusFlow TextEditor] CLIP encode error: {e}")
                pos_cond = []
                neg_cond = []

        output_pipe = (model, active_clip, vae, pos_cond, neg_cond) if (pipe is not None or active_clip is not None) else None

        # Update the node's widget values in the workflow metadata if available
        if unique_id is not None and extra_pnginfo is not None:
            if isinstance(extra_pnginfo, dict) and "workflow" in extra_pnginfo:
                workflow = extra_pnginfo["workflow"]
                node = next(
                    (x for x in workflow["nodes"] if str(x["id"]) == str(unique_id)),
                    None,
                )
                if node:
                    node["widgets_values"] = [positive, negative, saved_prompt, weight_mode, actual_seed]

        return (output_positive, output_negative, actual_seed, pos_cond, neg_cond, output_pipe)
