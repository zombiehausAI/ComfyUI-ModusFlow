import os
import sys
import re
import json
import time
import random
import torch
from nodes import CLIPTextEncode

class PromptList(list):
    def __str__(self):
        return ", ".join(str(x) for x in self)

class PromptDict(dict):
    def __str__(self):
        return ", ".join(f"{k}: {v}" for k, v in self.items())

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
    _cycle_counters = {}

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
    def extract_prompt_loras(prompt: str) -> tuple[list[dict], str]:
        """
        Parses <lora:name:strength> or <lora:name:model_weight:clip_weight> tags from prompt text.
        Ignores tags wrapped in /* ... */ comments.
        Returns:
            (lora_entries: list of dict(name, model_strength, clip_strength), clean_prompt: str)
        """
        if not prompt or not isinstance(prompt, str):
            return [], ""

        uncommented = re.sub(r'/\*.*?\*/', '', prompt, flags=re.DOTALL)
        pattern = r'<lora:([^:>]+)(?::([+-]?[0-9]*\.?[0-9]+))?(?::([+-]?[0-9]*\.?[0-9]+))?>'

        loras = []
        for m in re.finditer(pattern, uncommented, flags=re.IGNORECASE):
            name = m.group(1).strip()
            w1 = m.group(2)
            w2 = m.group(3)

            model_w = float(w1) if w1 is not None and w1 != '' else 1.0
            clip_w = float(w2) if w2 is not None and w2 != '' else model_w

            loras.append({
                "name": name,
                "model_strength": model_w,
                "clip_strength": clip_w,
            })

        clean = re.sub(r'/\*\s*<lora:[^>]+>\s*\*/|<lora:[^>]+>', '', prompt)
        clean = re.sub(r',\s*,+', ', ', clean)
        clean = re.sub(r'^[,\s]+|[,\s]+$', '', clean)
        return loras, clean

    @staticmethod
    def strip_lora_tags(text: str) -> str:
        """Strip <lora:filename:1.0> or <lora:filename> so raw angle brackets do not pollute prompts."""
        if not text or not isinstance(text, str):
            return ""
        clean = re.sub(r'/\*\s*<lora:[^>]+>\s*\*/|<lora:[^>]+>', '', text)
        clean = re.sub(r',\s*,+', ', ', clean)
        return re.sub(r'^[,\s]+|[,\s]+$', '', clean)

    @staticmethod
    def merge_and_deduplicate_negative(existing_negative: str, incoming_negative: str) -> str:
        """
        Merge incoming negative prompt tags into existing negative prompt,
        strictly deduplicating based on normalized base tag concepts (ignoring parentheses & weights).
        """
        if not incoming_negative or not incoming_negative.strip():
            return existing_negative

        def extract_base_tag(tag: str) -> str:
            t = tag.strip().lower()
            t = re.sub(r'^[(\[]+', '', t)
            t = re.sub(r'[)\]]+$', '', t)
            t = re.sub(r':-?[0-9.]+$', '', t).strip()
            return t

        existing_tags = [t.strip() for t in existing_negative.split(',') if t.strip()]
        seen_bases = {extract_base_tag(t) for t in existing_tags if extract_base_tag(t)}

        incoming_tags = [t.strip() for t in incoming_negative.split(',') if t.strip()]
        added_tags = []
        for it in incoming_tags:
            base = extract_base_tag(it)
            if base and base not in seen_bases:
                seen_bases.add(base)
                added_tags.append(it)

        if not added_tags:
            return existing_negative

        if existing_tags:
            return f"{existing_negative.strip(', ')}, {', '.join(added_tags)}"
        return ", ".join(added_tags)

    @staticmethod
    def resolve_dynamic_prompts(text: str, seed: int = None, cycle_index: int = 0, initial_vars: dict = None) -> str:
        """
        Resolve:
        - Modular File Imports (@import "path/file.txt", @import "subfolder/prompt.json")
        - Macro Functions (fn name($a, $b) = { ... }; invoked via @name(...))
        - Synced Tuples ([$hero, $color] = { [knight, silver] | [mage, violet] };)
        - Loops and Repetition (repeat(N) { ... }, for $var in $list { ... })
        - Variables ($color = {red|blue}; ... $color | filter)
        - Null-Coalescing ($var ?? "fallback", {$var ?? "fallback"})
        - Inline Arithmetic ({$age + 10}, (tag:{$weight + 0.2}))
        - Percentage Chance Modifiers ({40%: text})
        - Sequential & Cycling choices ({seq: a|b|c}, {cycle: a|b|c})
        - Random Numerical Ranges ({range: 18..35}, {range: 0.8..1.4:0.05})
        - Conditionals (CASE statements and Compound Ternaries: {$a && $b ? x : y})
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

        def get_prompts_dirs():
            dirs = []
            try:
                from ..config import settings, BASE_DIR
                p_dir = settings.get('prompts_save_directory', '').strip()
                if p_dir:
                    dirs.append(p_dir)
                default_dir = os.path.join(BASE_DIR, 'saved_prompts')
                if default_dir not in dirs:
                    dirs.append(default_dir)
            except Exception:
                try:
                    from config import settings, BASE_DIR
                    p_dir = settings.get('prompts_save_directory', '').strip()
                    if p_dir:
                        dirs.append(p_dir)
                    default_dir = os.path.join(BASE_DIR, 'saved_prompts')
                    if default_dir not in dirs:
                        dirs.append(default_dir)
                except Exception:
                    dirs.append(os.path.join(os.path.dirname(os.path.dirname(__file__)), 'saved_prompts'))
            return dirs

        def get_prompts_dir():
            dirs = get_prompts_dirs()
            return dirs[0] if dirs else ""

        # 0. Resolve Modular File Imports: @import "path/to/file" (.txt or .json)
        def resolve_imports(raw_text: str, max_depth: int = 5, seen_files: set = None) -> str:
            if seen_files is None:
                seen_files = set()
            if max_depth <= 0 or not raw_text or "@import" not in raw_text:
                return raw_text

            search_dirs = get_prompts_dirs()
            # Standalone line imports can strip the trailing semicolon; inline imports preserve the semicolon
            import_pattern = r'(?m)^[ \t]*@import\s+["\']([^"\']+)["\'][ \t]*(?:;)?\r?$|@import\s+["\']([^"\']+)["\']'

            def replace_import(m):
                rel_path = (m.group(1) or m.group(2)).strip()
                candidates = []
                if os.path.isabs(rel_path):
                    candidates.append(rel_path)
                for p_dir in search_dirs:
                    candidates.extend([
                        os.path.join(p_dir, rel_path),
                        os.path.join(p_dir, f"{rel_path}.txt"),
                        os.path.join(p_dir, f"{rel_path}.json"),
                        os.path.join(p_dir, "prompts", rel_path),
                        os.path.join(p_dir, "prompts", f"{rel_path}.txt"),
                        os.path.join(p_dir, "prompts", f"{rel_path}.json"),
                    ])
                if os.path.isabs(rel_path):
                    candidates.insert(0, rel_path)

                for cand in candidates:
                    cand_norm = os.path.normpath(cand)
                    if os.path.isfile(cand_norm):
                        if cand_norm in seen_files:
                            return f"/* recursive import loop: {rel_path} */"
                        seen_files.add(cand_norm)
                        try:
                            if cand_norm.endswith('.json'):
                                with open(cand_norm, 'r', encoding='utf-8') as f:
                                    data = json.load(f)
                                if isinstance(data, dict) and any(k in data for k in ("positive", "prompt", "text")) and not any(k in data for k in ("name", "role", "weapon", "class", "hp", "armor", "helm")):
                                    content = data.get("positive", data.get("prompt", data.get("text", "")))
                                else:
                                    content = json.dumps(data)
                            else:
                                with open(cand_norm, 'r', encoding='utf-8') as f:
                                    content = f.read()

                                raw_lines = [l.strip() for l in content.splitlines()]
                                lines = [l for l in raw_lines if l and not l.startswith(('#', '//'))]
                                # Check if pure YAML dictionary (every line has key: value, and not starting with $ or fn or { or [)
                                if lines and not lines[0].startswith(("{", "[", "$", "@")) and not any(l.startswith(("fn ", "def ")) for l in lines):
                                    is_yaml = True
                                    for l in lines:
                                        if ":" not in l:
                                            is_yaml = False
                                            break
                                    if is_yaml:
                                        content = "{\n" + "\n".join(lines) + "\n}"
                                elif len(lines) > 1 and all(l.startswith("{") and l.endswith("}") for l in lines):
                                    content = "[\n" + ",\n".join(lines) + "\n]"

                            return resolve_imports(content, max_depth - 1, seen_files)
                        except Exception as e:
                            return f"/* error importing {rel_path}: {e} */"
                return f"/* @import not found: {rel_path} */"

            return re.sub(import_pattern, replace_import, raw_text)

        text = resolve_imports(text)

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

        # Macro Functions: fn name($arg1, $arg2) = { body };
        macros = {}

        def parse_call_args(args_str):
            args = []
            cur = []
            d = 0
            in_quote = None
            for c in args_str:
                if in_quote:
                    cur.append(c)
                    if c == in_quote:
                        in_quote = None
                elif c in ('"', "'"):
                    in_quote = c
                    cur.append(c)
                elif c in ('{', '('):
                    d += 1
                    cur.append(c)
                elif c in ('}', ')'):
                    d -= 1
                    cur.append(c)
                elif c == ',' and d == 0:
                    args.append("".join(cur).strip().strip("'\""))
                    cur = []
                else:
                    cur.append(c)
            if cur:
                args.append("".join(cur).strip().strip("'\""))
            return args

        def resolve_macros(content, macro_defs, current_vars, call_depth=5):
            if call_depth <= 0 or not macro_defs or "@" not in content:
                return content

            for fn_name, (params, body) in macro_defs.items():
                pattern = rf'@{fn_name}\s*\('
                while True:
                    m = re.search(pattern, content)
                    if not m:
                        break
                    call_start = m.start()
                    args_start = m.end()
                    d = 1
                    pos = args_start
                    in_q = None
                    while pos < len(content) and d > 0:
                        ch = content[pos]
                        if in_q:
                            if ch == in_q:
                                in_q = None
                        elif ch in ('"', "'"):
                            in_q = ch
                        elif ch == '(':
                            d += 1
                        elif ch == ')':
                            d -= 1
                            if d == 0:
                                break
                        pos += 1

                    if d != 0:
                        break

                    raw_args = content[args_start:pos]
                    call_end = pos + 1
                    passed_args = parse_call_args(raw_args)

                    instantiated = body
                    for p_idx, p_name in enumerate(params):
                        val = passed_args[p_idx] if p_idx < len(passed_args) else ""
                        if val.startswith("$") and val[1:] in current_vars:
                            val = str(current_vars[val[1:]]).strip().strip("'\"")
                        else:
                            val = val.strip().strip("'\"")
                        instantiated = re.sub(rf'\${p_name}\b', val, instantiated)

                    instantiated = resolve_macros(instantiated, macro_defs, current_vars, call_depth - 1)
                    content = content[:call_start] + instantiated + content[call_end:]
            return content

        # Helpers for Array, List, and Dictionary parsing & Property Access
        def split_top_level(s_text, delims=(',', '\n')):
            parts = []
            cur = []
            d_b = d_br = d_p = 0
            in_q = None
            for c in s_text:
                if in_q:
                    cur.append(c)
                    if c == in_q:
                        in_q = None
                elif c in ('"', "'"):
                    in_q = c
                    cur.append(c)
                elif c == '{':
                    d_b += 1; cur.append(c)
                elif c == '}':
                    d_b -= 1; cur.append(c)
                elif c == '[':
                    d_br += 1; cur.append(c)
                elif c == ']':
                    d_br -= 1; cur.append(c)
                elif c == '(':
                    d_p += 1; cur.append(c)
                elif c == ')':
                    d_p -= 1; cur.append(c)
                elif c in delims and d_b == 0 and d_br == 0 and d_p == 0:
                    s_item = "".join(cur).strip()
                    if s_item:
                        parts.append(s_item)
                    cur = []
                else:
                    cur.append(c)
            if cur:
                s_item = "".join(cur).strip()
                if s_item:
                    parts.append(s_item)
            return parts

        # Helper: load wildcard file as a data structure or line selection
        def load_wildcard_resource(wc_spec: str, default_all: bool = False, local_vars: dict = None):
            m = re.match(r'^__(?:([0-9]+(?:-[0-9]+)?|all|\*)\$\$)?([a-zA-Z0-9_\-/]+)__$', wc_spec.strip())
            if not m:
                return None
            count_spec = m.group(1)
            wc_name = m.group(2).strip()
            search_dirs = get_prompts_dirs()
            candidates = []
            for d in search_dirs:
                candidates.extend([
                    os.path.join(d, 'wildcards', f"{wc_name}.json"),
                    os.path.join(d, 'wildcards', f"{wc_name}.txt"),
                    os.path.join(d, 'wildcards', wc_name),
                    os.path.join(d, f"{wc_name}.json"),
                    os.path.join(d, f"{wc_name}.txt"),
                ])
            target_file = None
            for c in candidates:
                if os.path.isfile(c):
                    target_file = c
                    break

            if not target_file:
                return None

            if target_file.endswith(".json"):
                try:
                    with open(target_file, "r", encoding="utf-8") as f:
                        data = json.load(f)
                    if isinstance(data, dict):
                        return PromptDict({k: parse_complex_value(json.dumps(v) if isinstance(v, (dict, list)) else str(v), local_vars) for k, v in data.items()})
                    elif isinstance(data, list):
                        parsed_list = PromptList([parse_complex_value(json.dumps(x) if isinstance(x, (dict, list)) else str(x), local_vars) for x in data])
                        if count_spec in ("all", "*") or default_all:
                            return parsed_list
                        k = int(count_spec) if count_spec and count_spec.isdigit() else 1
                        if k == 1 and parsed_list:
                            return rng.choice(parsed_list)
                        return PromptList(sample_items([(x, 1.0) for x in parsed_list], k))
                except Exception:
                    return None

            # Text file
            try:
                with open(target_file, "r", encoding="utf-8") as f:
                    content = f.read()
            except Exception:
                return None

            raw_lines = [l.strip() for l in content.splitlines()]
            lines = [l for l in raw_lines if l and not l.startswith(('#', '//'))]
            if not lines:
                return ""

            # Check if whole file is a single YAML-style dictionary
            is_yaml_dict = len(lines) > 0 and not lines[0].startswith(("{", "["))
            if is_yaml_dict:
                for l in lines:
                    if ":" not in l:
                        is_yaml_dict = False
                        break
            if is_yaml_dict:
                parsed_full = parse_complex_value("\n".join(lines), local_vars)
                if isinstance(parsed_full, PromptDict):
                    return parsed_full

            # Multiple entries
            parsed_lines = [parse_complex_value(line, local_vars) for line in lines]
            if count_spec in ("all", "*") or default_all:
                return PromptList(parsed_lines)

            k = parse_count(count_spec, len(parsed_lines)) if count_spec else 1
            if k == 1:
                return rng.choice(parsed_lines)
            return PromptList(sample_items([(x, 1.0) for x in parsed_lines], k))

        def parse_complex_value(raw: str, current_vars: dict = None):
            s = raw.strip()
            if not s:
                return s

            if s.startswith("__") and s.endswith("__"):
                wc_val = load_wildcard_resource(s, default_all=False, local_vars=current_vars)
                if wc_val is not None:
                    return wc_val

            is_single_bracketed = False
            if s.startswith('[') and s.endswith(']'):
                d_c = 0
                single_b = True
                for ch in s[:-1]:
                    if ch == '[': d_c += 1
                    elif ch == ']':
                        d_c -= 1
                        if d_c == 0:
                            single_b = False
                            break
                if single_b:
                    is_single_bracketed = True

            if is_single_bracketed:
                inner = s[1:-1].strip()
                if not inner:
                    return PromptList()
                items = split_top_level(inner, delims=(',', '\n'))
                parsed_items = [parse_complex_value(it, current_vars) for it in items]
                return PromptList(parsed_items)

            is_single_braced = False
            if s.startswith('{') and s.endswith('}'):
                d_c = 0
                single_b = True
                for ch in s[:-1]:
                    if ch == '{': d_c += 1
                    elif ch == '}':
                        d_c -= 1
                        if d_c == 0:
                            single_b = False
                            break
                if single_b:
                    is_single_braced = True

            inner = s[1:-1].strip() if is_single_braced else s

            d_b = d_br = d_p = 0
            in_q = None
            has_pipe_depth0 = False
            for c in inner:
                if in_q:
                    if c == in_q: in_q = None
                elif c in ('"', "'"): in_q = c
                elif c == '{': d_b += 1
                elif c == '}': d_b -= 1
                elif c == '[': d_br += 1
                elif c == ']': d_br -= 1
                elif c == '(': d_p += 1
                elif c == ')': d_p -= 1
                elif c == '|' and d_b == 0 and d_br == 0 and d_p == 0:
                    has_pipe_depth0 = True
                    break

            if not has_pipe_depth0:
                entries = split_top_level(inner, delims=(',', '\n', ';'))
                dict_candidates = []
                is_dict = bool(entries) and (is_single_braced or ('\n' in s and ':' in s) or len(entries) > 1 or ':' in s)
                for entry in entries:
                    col_idx = -1
                    d_b = d_br = d_p = 0
                    in_q = None
                    for idx, c in enumerate(entry):
                        if in_q:
                            if c == in_q: in_q = None
                        elif c in ('"', "'"): in_q = c
                        elif c == '{': d_b += 1
                        elif c == '}': d_b -= 1
                        elif c == '[': d_br += 1
                        elif c == ']': d_br -= 1
                        elif c == '(': d_p += 1
                        elif c == ')': d_p -= 1
                        elif c == ':' and d_b == 0 and d_br == 0 and d_p == 0:
                            if idx + 1 < len(entry) and entry[idx+1] == ':': continue
                            if idx > 0 and entry[idx-1] == ':': continue
                            col_idx = idx
                            break

                    if col_idx != -1:
                        k = entry[:col_idx].strip().strip("'\"")
                        v = entry[col_idx+1:].strip()
                        if re.match(r'^[a-zA-Z0-9_]+$', k):
                            dict_candidates.append((k, v))
                        else:
                            is_dict = False
                            break
                    else:
                        is_dict = False
                        break

                if is_dict and dict_candidates:
                    res_dict = PromptDict()
                    for k, v in dict_candidates:
                        res_dict[k] = parse_complex_value(v, current_vars)
                    return res_dict

            if (s.startswith('"') and s.endswith('"') and len(s) >= 2) or (s.startswith("'") and s.endswith("'") and len(s) >= 2):
                return s[1:-1]

            if s.startswith("$") and current_vars and s[1:] in current_vars:
                return current_vars[s[1:]]

            return s

        def evaluate_chain(base_val, chain_str):
            tokens = re.findall(r'\.([a-zA-Z0-9_]+(?:\(\))?)|\[\s*(-?[0-9]+|"[^"]*"|\'[^\']*\')\s*\]', chain_str)
            curr = base_val
            for prop, bracket in tokens:
                if prop:
                    prop_clean = prop.strip()
                    if prop_clean in ("length", "count", "length()", "count()"):
                        if isinstance(curr, (list, dict, str)):
                            curr = str(len(curr))
                        else:
                            curr = "0"
                    elif prop_clean in ("keys", "keys()"):
                        if isinstance(curr, dict):
                            curr = PromptList(list(curr.keys()))
                        else:
                            curr = PromptList()
                    elif prop_clean in ("values", "values()"):
                        if isinstance(curr, dict):
                            curr = PromptList(list(curr.values()))
                        else:
                            curr = PromptList()
                    elif prop_clean in ("first", "first()"):
                        if isinstance(curr, list) and curr:
                            curr = curr[0]
                        else:
                            curr = ""
                    elif prop_clean in ("last", "last()"):
                        if isinstance(curr, list) and curr:
                            curr = curr[-1]
                        else:
                            curr = ""
                    elif isinstance(curr, dict):
                        curr = curr.get(prop_clean, "")
                    else:
                        curr = ""
                elif bracket:
                    bracket_clean = bracket.strip()
                    if bracket_clean.startswith(('"', "'")) and bracket_clean.endswith(('"', "'")):
                        key = bracket_clean[1:-1]
                        if isinstance(curr, dict):
                            curr = curr.get(key, "")
                        else:
                            curr = ""
                    else:
                        try:
                            idx = int(bracket_clean)
                            if isinstance(curr, list):
                                curr = curr[idx]
                            else:
                                curr = ""
                        except (ValueError, IndexError):
                            curr = ""
            return curr

        def resolve_property_access(in_text, local_vars):
            chain_pat = re.compile(
                r'\$([a-zA-Z0-9_]+)((?:\.[a-zA-Z0-9_]+(?:\(\))?|\[\s*(?:-?[0-9]+|"[^"]*"|\'[^\']*\')\s*\])+)'
            )
            def repl(m):
                base = m.group(1)
                chain = m.group(2)
                if base in local_vars:
                    res = evaluate_chain(local_vars[base], chain)
                    return str(res)
                return m.group(0)
            return chain_pat.sub(repl, in_text)

        # 1. Sequentially resolve all definitions (macros, synced tuples, variables) top-to-bottom
        variables = dict(initial_vars) if initial_vars else {}
        out_chars = []
        ti = 0
        tn = len(text)
        depth = 0
        while ti < tn:
            if depth == 0:
                # Check for Macro definition: fn name($arg1, $arg2) = ... or def name(...) = ...
                m_fn = re.match(r'(?:^|\n)\s*(?:fn|def)\s+([a-zA-Z0-9_]+)\s*\(([^)]*)\)\s*=(?![>=])\s*', text[ti:])
                if m_fn:
                    fn_name = m_fn.group(1)
                    raw_params = m_fn.group(2)
                    params = [p.strip().lstrip('$') for p in raw_params.split(',') if p.strip()]
                    val_start = ti + m_fn.end()

                    # Case A: Triple quoted
                    m_tq = re.match(r'^(?:"""([\s\S]*?)"""|\'\'\'([\s\S]*?)\'\'\')[;\s]*', text[val_start:])
                    if m_tq:
                        raw_body = m_tq.group(1) if m_tq.group(1) is not None else m_tq.group(2)
                        macros[fn_name] = (params, ModusFlowTextEditor.filter_comments(raw_body).strip())
                        ti = val_start + m_tq.end()
                        continue

                    # Case B: Braced { ... }
                    if val_start < tn and text[val_start] == "{":
                        b_depth = 1
                        b_pos = val_start + 1
                        while b_pos < tn and b_depth > 0:
                            ch = text[b_pos]
                            if ch == "{": b_depth += 1
                            elif ch == "}": b_depth -= 1
                            b_pos += 1
                        if b_depth == 0:
                            inner_body = text[val_start + 1 : b_pos - 1]
                            m_semi = re.match(r'^\s*;', text[b_pos:])
                            if m_semi:
                                b_pos += m_semi.end()
                            macros[fn_name] = (params, ModusFlowTextEditor.filter_comments(inner_body).strip())
                            ti = b_pos
                            continue

                    # Case C: Semicolon terminated
                    m_semi = re.match(r'^([^;]+);', text[val_start:])
                    if m_semi:
                        macros[fn_name] = (params, ModusFlowTextEditor.filter_comments(m_semi.group(1)).strip())
                        ti = val_start + m_semi.end()
                        continue

                    # Case D: Single line
                    m_line = re.match(r'^([^\n;]+)(?:\n|$)', text[val_start:])
                    if m_line:
                        macros[fn_name] = (params, ModusFlowTextEditor.filter_comments(m_line.group(1)).strip())
                        ti = val_start + m_line.end()
                        continue

                # Check for Synced Tuples: [ $a, $b ] = { [x, y] | [w, z] };
                m_tuple = re.match(
                    r'^\s*\[\s*(\$[a-zA-Z0-9_]+(?:\s*,\s*\$[a-zA-Z0-9_]+)+)\s*\]\s*=\s*\{\s*(\[[^\]]+\](?:\s*\|\s*\[[^\]]+\])*)\s*\}[;\s]*',
                    text[ti:]
                )
                if m_tuple:
                    var_names = [v.strip().lstrip('$') for v in m_tuple.group(1).split(',')]
                    options_block = m_tuple.group(2)
                    raw_tuples = re.findall(r'\[([^\]]+)\]', options_block)
                    if raw_tuples:
                        chosen_tuple_str = rng.choice(raw_tuples)
                        tuple_vals = [tv.strip() for tv in chosen_tuple_str.split(',')]
                        for idx, v_name in enumerate(var_names):
                            val = tuple_vals[idx] if idx < len(tuple_vals) else ""
                            variables[v_name] = ModusFlowTextEditor.resolve_dynamic_prompts(val, seed=seed, cycle_index=cycle_index, initial_vars=variables)
                    ti += m_tuple.end()
                    continue

                # Check for variable definition starting with $varname = (excluding => and ==)
                m_var = re.match(r'(?:^|\n)\s*\$([a-zA-Z0-9_]+)\s*=(?![>=])\s*', text[ti:])
                if m_var:
                    v_name = m_var.group(1)
                    val_start = ti + m_var.end()

                    # Case A: Triple-quoted multiline: """ ... """ or ''' ... '''
                    m_tq = re.match(r'^(?:"""([\s\S]*?)"""|\'\'\'([\s\S]*?)\'\'\')[;\s]*', text[val_start:])
                    if m_tq:
                        raw_content = m_tq.group(1) if m_tq.group(1) is not None else m_tq.group(2)
                        raw_content = ModusFlowTextEditor.filter_comments(raw_content)
                        lines = [l.strip() for l in raw_content.splitlines() if l.strip()]
                        clean_val = "\n".join(lines)
                        eval_val = ModusFlowTextEditor.resolve_dynamic_prompts(clean_val, seed=seed, cycle_index=cycle_index, initial_vars=variables)
                        variables[v_name] = eval_val
                        ti = val_start + m_tq.end()
                        continue

                    # Case B: Braced multiline: { ... }
                    if val_start < tn and text[val_start] == "{":
                        b_depth = 1
                        b_pos = val_start + 1
                        while b_pos < tn and b_depth > 0:
                            ch = text[b_pos]
                            if ch == "{": b_depth += 1
                            elif ch == "}": b_depth -= 1
                            b_pos += 1
                        if b_depth == 0:
                            inner_content = text[val_start + 1 : b_pos - 1]
                            m_semi = re.match(r'^\s*;', text[b_pos:])
                            if m_semi:
                                b_pos += m_semi.end()

                            inner_content = ModusFlowTextEditor.filter_comments(inner_content)
                            lines = [l.strip() for l in inner_content.splitlines() if l.strip()]
                            clean_val = "\n".join(lines)

                            # First check if this is a dictionary { key: val, ... }
                            parsed_dict = parse_complex_value("{" + clean_val + "}", variables)
                            if isinstance(parsed_dict, PromptDict):
                                variables[v_name] = parsed_dict
                                ti = b_pos
                                continue

                            # Check if inner_content is dynamic syntax ({a|b} choices, CASE statements, seq, etc.)
                            is_dynamic_syntax = False
                            d = 0
                            for idx, c in enumerate(inner_content):
                                if c == "{": d += 1
                                elif c == "}": d -= 1
                                elif d == 0 and (c == "|" or c == "?" or inner_content[idx:idx+2] == "=>"):
                                    is_dynamic_syntax = True
                                    break
                            trimmed_inner = inner_content.strip()
                            if trimmed_inner.lower().startswith(("case ", "switch ", "seq:", "cycle:", "shuffle:", "range:", "rand:")):
                                is_dynamic_syntax = True
                            if trimmed_inner.startswith("$") and ":" in trimmed_inner:
                                is_dynamic_syntax = True

                            if is_dynamic_syntax:
                                clean_val = "{" + clean_val + "}"

                            eval_val = ModusFlowTextEditor.resolve_dynamic_prompts(clean_val, seed=seed, cycle_index=cycle_index, initial_vars=variables)
                            variables[v_name] = eval_val
                            ti = b_pos
                            continue

                    # Case C: Semicolon-terminated (single or multiline): ... ;
                    m_semi = re.match(r'^([^;]+);', text[val_start:])
                    if m_semi:
                        raw_content = m_semi.group(1)
                        raw_content = ModusFlowTextEditor.filter_comments(raw_content)
                        lines = [l.strip() for l in raw_content.splitlines() if l.strip()]
                        clean_val = "\n".join(lines)

                        # Check for list [ ... ], dict { ... }, or wildcard __name__
                        if (clean_val.startswith("[") and clean_val.endswith("]")) or \
                           (clean_val.startswith("{") and clean_val.endswith("}")) or \
                           (clean_val.startswith("__") and clean_val.endswith("__")):
                            parsed_comp = parse_complex_value(clean_val, variables)
                            if isinstance(parsed_comp, (PromptList, PromptDict)):
                                variables[v_name] = parsed_comp
                                ti = val_start + m_semi.end()
                                continue
                            elif clean_val.startswith("__") and clean_val.endswith("__") and parsed_comp is not None:
                                variables[v_name] = parsed_comp
                                ti = val_start + m_semi.end()
                                continue

                        if "|" in clean_val and not clean_val.startswith(("$", "{")) and "=>" not in clean_val:
                            clean_val = "{" + clean_val + "}"
                        eval_val = ModusFlowTextEditor.resolve_dynamic_prompts(clean_val, seed=seed, cycle_index=cycle_index, initial_vars=variables)
                        variables[v_name] = eval_val
                        ti = val_start + m_semi.end()
                        continue

                    # Case D: Single line without semicolon: ... \n
                    m_line = re.match(r'^([^\n;]+)(?:\n|$)', text[val_start:])
                    if m_line:
                        raw_content = m_line.group(1)
                        raw_content = ModusFlowTextEditor.filter_comments(raw_content)
                        clean_val = raw_content.strip()

                        # Check for list [ ... ], dict { ... }, or wildcard __name__
                        if (clean_val.startswith("[") and clean_val.endswith("]")) or \
                           (clean_val.startswith("{") and clean_val.endswith("}")) or \
                           (clean_val.startswith("__") and clean_val.endswith("__")):
                            parsed_comp = parse_complex_value(clean_val, variables)
                            if isinstance(parsed_comp, (PromptList, PromptDict)):
                                variables[v_name] = parsed_comp
                                ti = val_start + m_line.end()
                                continue
                            elif clean_val.startswith("__") and clean_val.endswith("__") and parsed_comp is not None:
                                variables[v_name] = parsed_comp
                                ti = val_start + m_line.end()
                                continue

                        if "|" in clean_val and not clean_val.startswith(("$", "{")) and "=>" not in clean_val:
                            clean_val = "{" + clean_val + "}"
                        eval_val = ModusFlowTextEditor.resolve_dynamic_prompts(clean_val, seed=seed, cycle_index=cycle_index, initial_vars=variables)
                        variables[v_name] = eval_val
                        ti = val_start + m_line.end()
                        continue

            if text[ti] == "{":
                depth += 1
            elif text[ti] == "}":
                depth = max(0, depth - 1)

            out_chars.append(text[ti])
            ti += 1
        text = "".join(out_chars)

        # Resolve macro function calls in main text
        if macros:
            text = resolve_macros(text, macros, variables)

        # 1.5. Resolve Loop Statements: repeat(N) { ... } and for ... in ... { ... }
        def parse_list_items(list_expr: str, current_vars: dict):
            expr = list_expr.strip()

            # Check if expr has property access or method call ($dict.keys(), $party[0].skills, etc.)
            m_chain = re.match(r'^\$([a-zA-Z0-9_]+)((?:\.[a-zA-Z0-9_]+(?:\(\))?|\[\s*(?:-?[0-9]+|"[^"]*"|\'[^\']*\')\s*\])+)$', expr)
            if m_chain:
                base = m_chain.group(1)
                chain = m_chain.group(2)
                if base in current_vars:
                    val = evaluate_chain(current_vars[base], chain)
                    if isinstance(val, (list, dict)):
                        return val
                    expr = str(val).strip()

            if expr.startswith("__") and expr.endswith("__"):
                wc_val = load_wildcard_resource(expr, default_all=True, local_vars=current_vars)
                if wc_val is not None:
                    return wc_val

            if expr.startswith("$") and expr[1:] in current_vars:
                val = current_vars[expr[1:]]
                if isinstance(val, (list, dict)):
                    return val
                expr = str(val).strip()

            m_range = re.match(r'^range\s*\(\s*([0-9]+)\s*(?:,\s*([0-9]+))?\s*(?:,\s*([0-9]+))?\s*\)$', expr, re.IGNORECASE)
            if m_range:
                start = int(m_range.group(1))
                if m_range.group(2) is not None:
                    stop = int(m_range.group(2))
                    step = int(m_range.group(3)) if m_range.group(3) else 1
                    return [str(x) for x in range(start, stop, step)[:20]]
                else:
                    return [str(x) for x in range(start)[:20]]

            m_dots = re.match(r'^([0-9]+)\s*\.\.\s*([0-9]+)$', expr)
            if m_dots:
                start = int(m_dots.group(1))
                stop = int(m_dots.group(2))
                return [str(x) for x in range(start, stop + 1)[:20]]

            if (expr.startswith("[") and expr.endswith("]")) or (expr.startswith("{") and expr.endswith("}")):
                parsed_comp = parse_complex_value(expr, current_vars)
                if isinstance(parsed_comp, (list, dict)):
                    return parsed_comp

            items = split_top_level(expr, delims=(',',))
            final_items = []
            for it in items:
                it_clean = it.strip()
                if it_clean.startswith("[") and it_clean.endswith("]"):
                    sub_items = [s.strip().strip("'\"") for s in it_clean[1:-1].split(",") if s.strip()]
                    final_items.append(sub_items)
                else:
                    final_items.append(it_clean.strip("'\""))

            return final_items[:20]

        def resolve_loops(input_text: str, current_vars: dict) -> str:
            # A. repeat(count) { body } or repeat(count as $i) { body }
            repeat_start_pat = re.compile(r'\brepeat\s*\(\s*([^)]+)\s*\)\s*(?:as\s+\$([a-zA-Z0-9_]+)\s*)?\{', re.IGNORECASE)
            while True:
                m = repeat_start_pat.search(input_text)
                if not m:
                    break
                raw_count = m.group(1).strip()
                idx_var_name = m.group(2)
                start_idx = m.start()
                body_start = m.end()

                d = 1
                pos = body_start
                tn = len(input_text)
                while pos < tn and d > 0:
                    ch = input_text[pos]
                    if ch == '{': d += 1
                    elif ch == '}':
                        d -= 1
                        if d == 0: break
                    pos += 1

                if d != 0:
                    break

                body = input_text[body_start:pos].strip()
                end_idx = pos + 1

                m_trail = re.match(r'^\s*[;,]?', input_text[end_idx:])
                if m_trail:
                    end_idx += m_trail.end()

                if raw_count.startswith("$") and raw_count[1:] in current_vars:
                    raw_count = str(current_vars[raw_count[1:]]).strip()
                try:
                    count = max(1, min(20, int(float(raw_count))))
                except Exception:
                    count = 1

                needs_delim = not body.rstrip().endswith((",", ";", "\n"))
                delim = ", " if needs_delim else " "

                parts = []
                for i in range(count):
                    iter_body = body
                    iter_body = re.sub(r'\$index\b', str(i + 1), iter_body)
                    iter_body = re.sub(r'\$i\b', str(i), iter_body)
                    if idx_var_name:
                        iter_body = re.sub(rf'\${idx_var_name}\b', str(i), iter_body)
                    parts.append(iter_body)

                loop_result = delim.join(parts)
                input_text = input_text[:start_idx] + loop_result + input_text[end_idx:]

            # B. for ... in ... { body }
            for_header = re.compile(
                r'\bfor\s+(?:\[\s*(\$[a-zA-Z0-9_]+(?:\s*,\s*\$[a-zA-Z0-9_]+)+)\s*\]|(\$[a-zA-Z0-9_]+(?:\s*,\s*\$[a-zA-Z0-9_]+)?))\s+in\s+',
                re.IGNORECASE
            )
            while True:
                m = for_header.search(input_text)
                if not m:
                    break

                # Scan forward tracking brackets, braces, and quotes until body opening brace '{'
                p = m.end()
                d_b = d_br = d_p = 0
                in_q = None
                tn = len(input_text)
                while p < tn:
                    c = input_text[p]
                    if in_q:
                        if c == in_q: in_q = None
                    elif c in ('"', "'"): in_q = c
                    elif c == '{':
                        if d_b == 0 and d_br == 0 and d_p == 0:
                            break
                        d_b += 1
                    elif c == '}': d_b -= 1
                    elif c == '[': d_br += 1
                    elif c == ']': d_br -= 1
                    elif c == '(': d_p += 1
                    elif c == ')': d_p -= 1
                    p += 1

                if p >= tn or input_text[p] != '{':
                    break

                tuple_vars_raw = m.group(1)
                single_or_pair_vars_raw = m.group(2)
                list_expr = input_text[m.end():p].strip()
                start_idx = m.start()
                body_start = p + 1

                d = 1
                pos = body_start
                while pos < tn and d > 0:
                    ch = input_text[pos]
                    if ch == '{': d += 1
                    elif ch == '}':
                        d -= 1
                        if d == 0: break
                    pos += 1

                if d != 0:
                    break

                body = input_text[body_start:pos].strip()
                end_idx = pos + 1

                m_trail = re.match(r'^\s*[;,]?', input_text[end_idx:])
                if m_trail:
                    end_idx += m_trail.end()

                iterable = parse_list_items(list_expr, current_vars)
                needs_delim = not body.rstrip().endswith((",", ";", "\n"))
                delim = ", " if needs_delim else " "

                parts = []
                if isinstance(iterable, dict):
                    names = [v.strip().lstrip('$') for v in single_or_pair_vars_raw.split(',') if v.strip()] if single_or_pair_vars_raw else []
                    for idx, (k, v) in enumerate(list(iterable.items())[:20]):
                        iter_body = body
                        iter_vars = dict(current_vars)
                        if len(names) >= 2:
                            k_name, v_name = names[0], names[1]
                            iter_vars[k_name] = k
                            iter_vars[v_name] = v
                            iter_body = resolve_property_access(iter_body, iter_vars)
                            iter_body = re.sub(rf'\${k_name}\b(?!\.[a-zA-Z_]|\[)', str(k), iter_body)
                            iter_body = re.sub(rf'\${v_name}\b(?!\.[a-zA-Z_]|\[)', str(v), iter_body)
                        elif len(names) == 1:
                            v_name = names[0]
                            iter_vars[v_name] = v
                            iter_body = resolve_property_access(iter_body, iter_vars)
                            iter_body = re.sub(rf'\${v_name}\b(?!\.[a-zA-Z_]|\[)', str(v), iter_body)
                        iter_body = re.sub(r'\$index\b', str(idx + 1), iter_body)
                        iter_body = re.sub(r'\$i\b', str(idx), iter_body)
                        parts.append(iter_body)
                else:
                    items_list = list(iterable)[:20]
                    if tuple_vars_raw:
                        var_names = [v.strip().lstrip('$') for v in tuple_vars_raw.split(',') if v.strip()]
                        is_tuple = True
                        idx_name = None
                    else:
                        names = [v.strip().lstrip('$') for v in single_or_pair_vars_raw.split(',') if v.strip()]
                        if len(names) == 2:
                            idx_name, var_name = names[0], names[1]
                            var_names = [var_name]
                            is_tuple = False
                        else:
                            idx_name = None
                            var_names = [names[0]]
                            is_tuple = False

                    for idx, item in enumerate(items_list):
                        iter_body = body
                        iter_vars = dict(current_vars)
                        if is_tuple:
                            sub_vals = item if isinstance(item, (list, tuple)) else [item]
                            for v_idx, v_name in enumerate(var_names):
                                v_val = sub_vals[v_idx] if v_idx < len(sub_vals) else ""
                                iter_vars[v_name] = v_val
                            iter_body = resolve_property_access(iter_body, iter_vars)
                            for v_idx, v_name in enumerate(var_names):
                                v_val = iter_vars[v_name]
                                iter_body = re.sub(rf'\${v_name}\b(?!\.[a-zA-Z_]|\[)', str(v_val), iter_body)
                        else:
                            v_name = var_names[0]
                            iter_vars[v_name] = item
                            if idx_name:
                                iter_vars[idx_name] = idx
                                iter_body = re.sub(rf'\${idx_name}\b(?!\.[a-zA-Z_]|\[)', str(idx), iter_body)
                            iter_body = resolve_property_access(iter_body, iter_vars)
                            iter_body = re.sub(rf'\${v_name}\b(?!\.[a-zA-Z_]|\[)', str(item), iter_body)

                        iter_body = re.sub(r'\$index\b', str(idx + 1), iter_body)
                        iter_body = re.sub(r'\$i\b', str(idx), iter_body)
                        parts.append(iter_body)

                loop_result = delim.join(parts)
                input_text = input_text[:start_idx] + loop_result + input_text[end_idx:]

            return input_text

        text = resolve_loops(text, variables)

        # 2. Resolve Conditionals (CASE Statements and Ternaries with Compound Logic):
        def eval_condition(var_val, op, target):
            var_val = "" if var_val is None else str(var_val).strip().strip("'\"")
            target = "" if target is None else str(target).strip().strip("'\"")

            if not op:
                return bool(var_val) and var_val.lower() not in ("false", "0", "none", "off", "no")

            op = op.lower().strip()

            # Check if target is a choice block {a|b} or set: {futanari|woman}
            m_set = re.match(r"^\{([^}]+)\}$", target)
            if m_set:
                opts = [o.strip().strip("'\"").lower() for o in m_set.group(1).split("|") if o.strip()]
                if op in ("==", "in"):
                    return var_val.lower() in opts
                elif op in ("!=", "not in"):
                    return var_val.lower() not in opts

            # Check if target is a pipe-separated or comma-separated list of values: a|b or a, b
            if ("|" in target or "," in target) and op in ("==", "in", "!=", "not in"):
                delims = "|" if "|" in target else ","
                opts = [o.strip().strip("'\"").lower() for o in target.split(delims) if o.strip()]
                if op in ("==", "in"):
                    return var_val.lower() in opts
                elif op in ("!=", "not in"):
                    return var_val.lower() not in opts

            # Target variable lookup: $var
            if target.startswith("$") and target[1:] in variables:
                target = str(variables[target[1:]]).strip().strip("'\"")

            if op in ("==", "in"):
                return var_val.lower() == target.lower()
            elif op in ("!=", "not in"):
                return var_val.lower() != target.lower()
            elif op in (">", ">=", "<", "<="):
                try:
                    v_num = float(var_val)
                    t_num = float(target)
                    if op == ">": return v_num > t_num
                    if op == ">=": return v_num >= t_num
                    if op == "<": return v_num < t_num
                    if op == "<=": return v_num <= t_num
                except (ValueError, TypeError):
                    if op == ">": return var_val > target
                    if op == ">=": return var_val >= target
                    if op == "<": return var_val < target
                    if op == "<=": return var_val <= target
            return False

        def eval_single_condition(sub_cond: str) -> bool:
            sub_cond = resolve_property_access(sub_cond.strip(), variables)
            if not sub_cond:
                return False

            is_negated = False
            if sub_cond.startswith("!"):
                is_negated = True
                sub_cond = sub_cond[1:].strip()
            elif sub_cond.lower().startswith("not ") and not sub_cond.lower().startswith("not in"):
                is_negated = True
                sub_cond = sub_cond[4:].strip()

            m_comp = re.match(r"^([$]?[a-zA-Z0-9_.]+)\s*(==|!=|>=|<=|>|<|not\s+in|in)\s*(.*)$", sub_cond, re.IGNORECASE)
            if m_comp:
                left_raw = m_comp.group(1).strip()
                op = m_comp.group(2).strip().lower()
                right_raw = m_comp.group(3).strip()

                left_val = left_raw
                if left_raw.startswith("$") and left_raw[1:] in variables:
                    left_val = str(variables[left_raw[1:]])
                elif left_raw in variables:
                    left_val = str(variables[left_raw])

                res = eval_condition(left_val, op, right_raw)
                return not res if is_negated else res

            var_name = sub_cond.lstrip("$").strip()
            if var_name in variables:
                val = str(variables[var_name]).strip()
                res = bool(val) and val.lower() not in ("false", "0", "none", "off", "no", "")
            else:
                res = bool(var_name) and var_name.lower() not in ("false", "0", "none", "off", "no", "")
            return not res if is_negated else res

        def eval_compound_condition(cond_str: str) -> bool:
            cond_str = cond_str.strip()
            if not cond_str:
                return False

            def split_by_op(s, op):
                parts = []
                cur_chars = []
                p_d = 0
                idx = 0
                slen = len(s)
                op_len = len(op)
                while idx < slen:
                    ch = s[idx]
                    if ch == "(": p_d += 1
                    elif ch == ")": p_d -= 1
                    elif p_d == 0 and s[idx:idx+op_len] == op:
                        parts.append("".join(cur_chars).strip())
                        cur_chars = []
                        idx += op_len
                        continue
                    cur_chars.append(ch)
                    idx += 1
                if cur_chars:
                    parts.append("".join(cur_chars).strip())
                return parts

            or_branches = split_by_op(cond_str, "||")
            for or_b in or_branches:
                and_parts = split_by_op(or_b, "&&")
                all_and_true = True
                for and_p in and_parts:
                    p = and_p.strip()
                    if p.startswith("(") and p.endswith(")"):
                        inner_d = 0
                        balanced = True
                        for inner_ch in p[:-1]:
                            if inner_ch == "(": inner_d += 1
                            elif inner_ch == ")":
                                inner_d -= 1
                                if inner_d == 0:
                                    balanced = False
                                    break
                        if balanced:
                            part_res = eval_compound_condition(p[1:-1])
                        else:
                            part_res = eval_single_condition(p)
                    else:
                        part_res = eval_single_condition(p)

                    if not part_res:
                        all_and_true = False
                        break
                if all_and_true:
                    return True
            return False

        # 2. Resolve Conditionals (CASE Statements and Ternaries):
        # CASE:    {$var: val1 => result1 | val2 => result2 | * => default} or {case $var: ...}
        # Ternary: {$var==val?true:false}, {$var!=val?...}, {$var?true:false}
        def parse_and_resolve_conditionals(input_text):
            out = []
            i = 0
            n = len(input_text)
            has_match = False
            while i < n:
                m_case_pre = re.match(r'^\{(?:case|switch)\s+', input_text[i:], re.IGNORECASE)
                is_cond_candidate = (
                    input_text[i:i+2] in ("{$", "{(") or
                    (input_text[i:i+2] == "{!" and not input_text[i:].lower().startswith("{!neg:")) or
                    m_case_pre
                )
                if is_cond_candidate:
                    start = i
                    i += m_case_pre.end() if m_case_pre else 1
                    depth = 1
                    inner_chars = []
                    while i < n and depth > 0:
                        ch = input_text[i]
                        if ch == "{":
                            depth += 1
                        elif ch == "}":
                            depth -= 1
                            if depth == 0:
                                i += 1
                                break
                        inner_chars.append(ch)
                        i += 1

                    if depth == 0:
                        inner = "".join(inner_chars)

                        # Check if this is a CASE statement: contains '=>' at depth 0
                        has_arrow = False
                        first_arrow_idx = -1
                        d = 0
                        for idx in range(len(inner) - 1):
                            c = inner[idx]
                            if c == "{": d += 1
                            elif c == "}": d -= 1
                            elif inner[idx:idx+2] == "=>" and d == 0:
                                has_arrow = True
                                first_arrow_idx = idx
                                break

                        if has_arrow:
                            colon_idx = -1
                            d = 0
                            for idx in range(first_arrow_idx):
                                c = inner[idx]
                                if c == "{": d += 1
                                elif c == "}": d -= 1
                                elif c == ":" and d == 0:
                                    colon_idx = idx
                                    break

                            var_part = None
                            cases_part = None
                            if colon_idx != -1:
                                var_part = inner[:colon_idx].strip()
                                cases_part = inner[colon_idx+1:]
                            else:
                                before_arrow = inner[:first_arrow_idx]
                                m_v = re.match(r'^\s*(?:case\s+|switch\s+)?(\$[a-zA-Z0-9_]+|[a-zA-Z0-9_]+|\{[^{}]+\})\s*', before_arrow, re.IGNORECASE)
                                if m_v:
                                    var_part = m_v.group(1).strip()
                                    cases_part = inner[m_v.end():]
                                elif '\n' in before_arrow:
                                    lines = before_arrow.split('\n', 1)
                                    var_part = lines[0].strip()
                                    cases_part = inner[len(lines[0])+1:]

                            if var_part is not None and cases_part is not None:
                                var_part = var_part.strip()
                                cases_part = cases_part

                                if var_part.lower().startswith(("case ", "switch ")):
                                    var_part = var_part[5:].strip()
                                if var_part.startswith("{") and var_part.endswith("}"):
                                    var_part = var_part[1:-1].strip()

                                clean_vname = var_part.lstrip("$").strip()
                                if clean_vname in variables:
                                    var_val = str(variables[clean_vname])
                                else:
                                    eval_target = var_part
                                    eval_target = resolve_property_access(eval_target, variables)
                                    for vn, vv in variables.items():
                                        eval_target = re.sub(rf'\${vn}\b(?!\.[a-zA-Z_]|\[)', str(vv), eval_target)
                                    if "{" in eval_target or "|" in eval_target:
                                        eval_target = ModusFlowTextEditor.resolve_dynamic_prompts(eval_target, seed=seed, cycle_index=cycle_index, initial_vars=variables)
                                    var_val = eval_target.strip()

                                # Split cases_part into branches (checking if '|' separates branches at depth 0)
                                has_pipe_separator = False
                                d = 0
                                cp_len = len(cases_part)
                                for idx, c in enumerate(cases_part):
                                    if c == "{": d += 1
                                    elif c == "}": d -= 1
                                    elif c == "|" and d == 0:
                                        sub_d = 0
                                        for f_idx in range(idx + 1, cp_len):
                                            f_ch = cases_part[f_idx]
                                            if f_ch == "{": sub_d += 1
                                            elif f_ch == "}": sub_d -= 1
                                            elif sub_d == 0 and cases_part[f_idx:f_idx+2] == "=>":
                                                has_pipe_separator = True
                                                break
                                        if has_pipe_separator:
                                            break

                                branches = []
                                cur_b = []
                                d = 0

                                if has_pipe_separator:
                                    for idx, ch in enumerate(cases_part):
                                        if ch == "{":
                                            d += 1; cur_b.append(ch)
                                        elif ch == "}":
                                            d -= 1; cur_b.append(ch)
                                        elif ch == "|" and d == 0:
                                            branches.append("".join(cur_b).strip())
                                            cur_b = []
                                        else:
                                            cur_b.append(ch)
                                    if cur_b:
                                        branches.append("".join(cur_b).strip())
                                else:
                                    lines = cases_part.splitlines(keepends=True)
                                    cur_lines = []
                                    for line in lines:
                                        has_arrow_at_depth0 = False
                                        sub_d = 0
                                        for l_idx in range(len(line) - 1):
                                            c = line[l_idx]
                                            if c == "{": sub_d += 1
                                            elif c == "}": sub_d -= 1
                                            elif sub_d == 0 and line[l_idx:l_idx+2] == "=>":
                                                has_arrow_at_depth0 = True
                                                break

                                        if has_arrow_at_depth0 and cur_lines:
                                            branches.append("".join(cur_lines).strip())
                                            cur_lines = [line]
                                        else:
                                            cur_lines.append(line)

                                    if cur_lines:
                                        branches.append("".join(cur_lines).strip())

                                matched_branch_val = None
                                default_val = None

                                for branch in branches:
                                    if not branch:
                                        continue
                                    arrow_idx = -1
                                    d = 0
                                    for idx in range(len(branch) - 1):
                                        c = branch[idx]
                                        if c == "{": d += 1
                                        elif c == "}": d -= 1
                                        elif branch[idx:idx+2] == "=>" and d == 0:
                                            arrow_idx = idx
                                            break

                                    if arrow_idx == -1:
                                        continue

                                    patterns_str = branch[:arrow_idx].strip()
                                    result_str = branch[arrow_idx+2:].strip()

                                    if patterns_str.lower() in ("*", "_", "default", "else"):
                                        if default_val is None:
                                            default_val = result_str
                                        continue

                                    sub_patterns = []
                                    for p in patterns_str.split(","):
                                        p = p.strip()
                                        if not p:
                                            continue
                                        # Support dynamic choice syntax in patterns: {opt1|opt2} => ...
                                        m_choice = re.match(r"^\{([^}]+)\}$", p)
                                        if m_choice:
                                            sub_patterns.extend([c.strip() for c in m_choice.group(1).split("|") if c.strip()])
                                        else:
                                            choice_matches = list(re.finditer(r"\{([^}]+)\}", p))
                                            if choice_matches:
                                                parts = [c.strip() for c in choice_matches[0].group(1).split("|") if c.strip()]
                                                for part in parts:
                                                    sub_patterns.append(p[:choice_matches[0].start()] + part + p[choice_matches[0].end():])
                                            else:
                                                sub_patterns.append(p)
                                    branch_matched = False
                                    for pat in sub_patterns:
                                        if pat.startswith("$") and pat[1:] in variables:
                                            pat = variables[pat[1:]]
                                        m_op = re.match(r"^(==|!=|>=|<=|>|<)\s*(.*)$", pat)
                                        if m_op:
                                            op = m_op.group(1)
                                            target = m_op.group(2).strip()
                                            if target.startswith("$") and target[1:] in variables:
                                                target = variables[target[1:]]
                                            if eval_condition(var_val, op, target):
                                                branch_matched = True
                                                break
                                        else:
                                            clean_pat = pat.strip("'\"")
                                            if clean_pat.startswith("$") and clean_pat[1:] in variables:
                                                clean_pat = str(variables[clean_pat[1:]]).strip("'\"")
                                            clean_var = str(var_val).strip().strip("'\"")
                                            if clean_var.lower() == clean_pat.lower():
                                                branch_matched = True
                                                break

                                    if branch_matched:
                                        matched_branch_val = result_str
                                        break

                                chosen = matched_branch_val if matched_branch_val is not None else (default_val if default_val is not None else "")
                                out.append(chosen)
                                has_match = True
                                continue

                        # Otherwise check for Ternary conditional: contains '?' at depth 0
                        q_idx = -1
                        d = 0
                        for idx, c in enumerate(inner):
                            if c in ("{", "("): d += 1
                            elif c in ("}", ")"): d -= 1
                            elif c == "?" and d == 0:
                                if inner[idx:idx+2] == "??" or (idx > 0 and inner[idx-1] == "?"):
                                    continue
                                q_idx = idx
                                break

                        if q_idx != -1 and not has_arrow:
                            cond_part = inner[:q_idx].strip()
                            rest = inner[q_idx+1:]
                            colon_idx = -1
                            d = 0
                            for idx, c in enumerate(rest):
                                if c in ("{", "("): d += 1
                                elif c in ("}", ")"): d -= 1
                                elif c == ":" and d == 0:
                                    colon_idx = idx
                                    break

                            if colon_idx != -1:
                                true_b = rest[:colon_idx].strip()
                                false_b = rest[colon_idx+1:].strip()
                            else:
                                true_b = rest.strip()
                                false_b = ""

                            is_true = eval_compound_condition(cond_part)
                            chosen = true_b if is_true else false_b
                            out.append(chosen)
                            has_match = True
                            continue
                    out.append(input_text[start:i])
                else:
                    out.append(input_text[i])
                    i += 1
            return "".join(out), has_match

        for _ in range(5):
            text, matched = parse_and_resolve_conditionals(text)
            if not matched:
                break

        text = resolve_property_access(text, variables)

        # Known filter names for piped variable transformations
        KNOWN_FILTERS = {
            "upper", "lower", "title", "capitalize", "trim",
            "weight", "wrap", "default", "plural",
            "strip_weights", "strip_weight", "noweight", "join",
            "count", "length", "keys", "values", "first", "last", "reverse", "sort"
        }

        # Substitute defined variables with optional filters ($varname | filter)
        def apply_filter(val: str, filter_expr: str, raw_var = None) -> str:
            val_str = str(val).strip().strip("'\"")
            filter_expr = filter_expr.strip()
            f_name = filter_expr.lower()
            arg = None
            m_call = re.match(r'^([a-zA-Z0-9_]+)\((.*)\)$', filter_expr)
            if m_call:
                f_name = m_call.group(1).lower()
                arg = m_call.group(2).strip().strip("'\"")

            if f_name not in KNOWN_FILTERS:
                return None

            if f_name in ("count", "length"):
                if isinstance(raw_var, (list, dict)):
                    return str(len(raw_var))
                items = [x for x in str(val).split(",") if x.strip()]
                return str(len(items))
            elif f_name == "keys":
                if isinstance(raw_var, dict):
                    return ", ".join(str(k) for k in raw_var.keys())
                return ""
            elif f_name == "values":
                if isinstance(raw_var, dict):
                    return ", ".join(str(v) for v in raw_var.values())
                return val_str
            elif f_name == "first":
                if isinstance(raw_var, list) and raw_var:
                    return str(raw_var[0])
                items = [x.strip() for x in str(val).split(",") if x.strip()]
                return items[0] if items else ""
            elif f_name == "last":
                if isinstance(raw_var, list) and raw_var:
                    return str(raw_var[-1])
                items = [x.strip() for x in str(val).split(",") if x.strip()]
                return items[-1] if items else ""
            elif f_name == "reverse":
                if isinstance(raw_var, list):
                    return ", ".join(reversed([str(x) for x in raw_var]))
                items = [x.strip() for x in str(val).split(",") if x.strip()]
                return ", ".join(reversed(items))
            elif f_name == "sort":
                if isinstance(raw_var, list):
                    return ", ".join(sorted([str(x) for x in raw_var]))
                items = [x.strip() for x in str(val).split(",") if x.strip()]
                return ", ".join(sorted(items))
            elif f_name == "upper":
                return val_str.upper()
            elif f_name == "lower":
                return val_str.lower()
            elif f_name == "title":
                return val_str.title()
            elif f_name == "capitalize":
                return val_str.capitalize()
            elif f_name == "trim":
                return val_str.strip()
            elif f_name == "weight":
                w = arg if arg else "1.2"
                return f"({val_str}:{w})"
            elif f_name == "wrap":
                parts = [p.strip().strip("'\"") for p in (arg or "").split(",") if p.strip()]
                prefix = parts[0] if len(parts) > 0 else "("
                suffix = parts[1] if len(parts) > 1 else ")"
                return f"{prefix}{val_str}{suffix}"
            elif f_name == "default":
                return val_str if val_str.strip() else (arg or "")
            elif f_name == "plural":
                w = val_str.strip()
                if not w:
                    return val_str
                lw = w.lower()
                if lw.endswith(('s', 'sh', 'ch', 'x', 'z')):
                    return w + ("es" if w[-1].islower() else "ES")
                elif lw.endswith('y') and len(lw) > 1 and lw[-2] not in "aeiou":
                    return w[:-1] + ("ies" if w[-1].islower() else "IES")
                elif lw.endswith('fe') and len(lw) > 2:
                    return w[:-2] + ("ves" if w[-2:] == 'fe' else "VES")
                elif lw.endswith('f') and not lw.endswith(('ff', 'oof', 'ief', 'eef')):
                    return w[:-1] + ("ves" if w[-1].islower() else "VES")
                else:
                    return w + ("s" if w[-1].islower() else "S")
            elif f_name in ("strip_weights", "strip_weight", "noweight"):
                res = re.sub(r'\(([^:()]+):[0-9.]+\)', r'\1', val_str)
                res = re.sub(r'[\(\)\[\]]', '', res)
                return res.strip()
            elif f_name == "join":
                sep = arg if arg is not None else ", "
                if isinstance(raw_var, list):
                    return sep.join(str(x) for x in raw_var)
                items = [x.strip() for x in re.split(r'[,\n]+', val_str) if x.strip()]
                return sep.join(items)
            return val_str

        # 1. Null-Coalescing: $var ?? "fallback" or {$var ?? "fallback"}
        null_coalesce_pattern = r'(\{)?\$([a-zA-Z0-9_]+)\s*\?\?\s*("(?:\\.|[^"\\])*"|\'(?:\\.|[^\'\\])*\'|\$[a-zA-Z0-9_]+|[a-zA-Z0-9_\-\.]+)(\})?'
        def replace_null_coalesce(match):
            v_name = match.group(2)
            fallback = match.group(3).strip()

            if fallback.startswith(('"', "'")) and fallback.endswith(('"', "'")) and len(fallback) >= 2:
                fallback_val = fallback[1:-1]
            elif fallback.startswith("$") and fallback[1:] in variables:
                fallback_val = str(variables[fallback[1:]])
            else:
                fallback_val = fallback

            val_clean = str(variables.get(v_name, "")).strip().strip("'\"")
            if v_name in variables and val_clean:
                return str(variables[v_name])
            return fallback_val

        text = re.sub(null_coalesce_pattern, replace_null_coalesce, text)

        # 2. Inline Arithmetic: {$var + 5}, {$a * $b}, {10 - 2}
        arith_pattern = r'\{([$a-zA-Z0-9_.]+)\s*([\+\-\*\/])\s*([$a-zA-Z0-9_.]+)\}'
        def replace_arithmetic(match):
            op1_raw = match.group(1).strip()
            op = match.group(2).strip()
            op2_raw = match.group(3).strip()

            def resolve_num(val_str):
                v = val_str
                if v.startswith("$") and v[1:] in variables:
                    v = str(variables[v[1:]]).strip()
                elif v in variables:
                    v = str(variables[v]).strip()
                try:
                    if '.' in v:
                        return float(v)
                    return int(v)
                except ValueError:
                    return None

            n1 = resolve_num(op1_raw)
            n2 = resolve_num(op2_raw)
            if n1 is None or n2 is None:
                return match.group(0)

            try:
                if op == '+': res = n1 + n2
                elif op == '-': res = n1 - n2
                elif op == '*': res = n1 * n2
                elif op == '/':
                    if n2 == 0: return match.group(0)
                    res = n1 / n2
                else: return match.group(0)

                if isinstance(res, (int, float)) and (isinstance(res, int) or res.is_integer()):
                    return str(int(res))
                else:
                    return f"{res:.4f}".rstrip('0').rstrip('.')
            except Exception:
                return match.group(0)

        text = re.sub(arith_pattern, replace_arithmetic, text)

        # 3. Match piped variable calls: $var | filter1 | filter2 or {$var | filter1 | filter2}
        for var_name, var_val in variables.items():
            pipe_pattern = rf'(?:\{{)?\${var_name}\s*\|\s*([a-zA-Z0-9_]+(?:\([^)]*\))?(?:\s*\|\s*[a-zA-Z0-9_]+(?:\([^)]*\))?)*)(?:\}})?'
            def replace_piped(m):
                res = str(var_val)
                filters = m.group(1).split('|')
                all_valid = True
                for f in filters:
                    filtered = apply_filter(res, f, raw_var=var_val)
                    if filtered is None:
                        all_valid = False
                        break
                    res = filtered
                return res if all_valid else m.group(0)
            text = re.sub(pipe_pattern, replace_piped, text)

        # 4. Match standard $varname substitutions (not followed by dot or bracket property access)
        for var_name, var_val in variables.items():
            text = re.sub(rf'\${var_name}\b(?!\.[a-zA-Z_]|\[)', str(var_val), text)

        # 3. Resolve {shuffle: a, b, c}
        def replace_shuffle(match):
            items = [x.strip() for x in match.group(1).split(',') if x.strip()]
            rng.shuffle(items)
            return ", ".join(items)

        text = re.sub(r'\{shuffle:\s*([^{}]+)\}', replace_shuffle, text, flags=re.IGNORECASE)

        # 4. Resolve {seq: a | b | c} or {cycle: a | b | c} (deterministic stepping)
        def replace_seq(match):
            items = [x.strip() for x in match.group(1).split('|') if x.strip()]
            if not items:
                return ""
            idx = int(cycle_index) % len(items)
            return items[idx]

        text = re.sub(r'\{(?:seq|cycle):\s*([^{}]+)\}', replace_seq, text, flags=re.IGNORECASE)

        # 5. Resolve {range: min..max[:step]} and {rand: min..max[:step]}
        def replace_range(match):
            content = match.group(1).strip()
            step = None
            if ':' in content:
                parts = content.split(':', 1)
                content = parts[0].strip()
                step = parts[1].strip()

            if '..' in content:
                r_parts = content.split('..', 1)
            elif '-' in content and not content.startswith('-'):
                r_parts = content.split('-', 1)
            else:
                return match.group(0)

            min_str = r_parts[0].strip()
            max_str = r_parts[1].strip()

            is_float = ('.' in min_str or '.' in max_str or (step and '.' in step) or (step and 'float' in step.lower()))
            try:
                if is_float:
                    min_val = float(min_str)
                    max_val = float(max_str)
                    if step and step.lower() not in ("float", "f"):
                        step_val = float(step)
                        dec_places = len(step.split('.')[1]) if '.' in step else 2
                        steps_count = int(round((max_val - min_val) / step_val))
                        chosen_step = rng.randint(0, max(0, steps_count))
                        val = min_val + (chosen_step * step_val)
                        return f"{val:.{dec_places}f}"
                    else:
                        val = rng.uniform(min_val, max_val)
                        return f"{val:.2f}"
                else:
                    min_val = int(min_str)
                    max_val = int(max_str)
                    step_val = int(step) if step and step.isdigit() else 1
                    val = rng.randrange(min_val, max_val + 1, step_val)
                    return str(val)
            except Exception:
                return match.group(0)

        text = re.sub(r'\{(?:range|rand):\s*([^{}]+)\}', replace_range, text, flags=re.IGNORECASE)

        # 3. Resolve Pick-N, Weighted, and standard choices:
        # e.g. {2$$a|b|c}, {1-3$$a|b|c}, {80::blue|20::red}, {a|b|c}
        def replace_choice(match):
            content = match.group(1).strip()
            if content.lower().startswith('!neg:'):
                return match.group(0)
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

        # Helper: resolve __wildcard__ and __N$$wildcard__ file references (strictly within saved_prompts)
        def replace_wildcard(match):
            wc_spec = match.group(0)
            res = load_wildcard_resource(wc_spec, local_vars=variables)
            if res is not None:
                return str(res)
            return wc_spec

        # 3 & 4. Iteratively resolve percentage chances, choices, and wildcards (up to 10 passes)
        # This guarantees:
        # - Percentage chances {40%: text} evaluate cleanly
        # - Wildcard list rows can contain choices like `wearing {red|blue} sneakers`
        # - Dynamic choices can select between wildcards like `{__hats__|__helmets__}`
        # - Nested choices `{a|{b|c}}` resolve from inside out
        # - Recursive wildcards resolve cleanly
        pct_pattern = r'\{([0-9]+(?:\.[0-9]+)?)\s*%\s*:\s*([^{}]+)\}'
        choice_pattern = r'\{([^{}]+)\}'
        wc_pattern = r'__(?:([0-9]+(?:-[0-9]+)?|all|\*)\$\$)?([a-zA-Z0-9_\-/]+)__'

        def replace_pct_chance(match):
            pct_str = match.group(1)
            content = match.group(2)
            try:
                pct = float(pct_str)
                if rng.random() * 100.0 < pct:
                    return content
                return ""
            except Exception:
                return match.group(0)

        for _ in range(10):
            changed = False
            if re.search(pct_pattern, text):
                new_text = re.sub(pct_pattern, replace_pct_chance, text)
                if new_text != text:
                    text = new_text
                    changed = True
            if re.search(wc_pattern, text):
                new_text = re.sub(wc_pattern, replace_wildcard, text)
                if new_text != text:
                    text = new_text
                    changed = True
            if re.search(choice_pattern, text):
                new_text = re.sub(choice_pattern, replace_choice, text)
                if new_text != text:
                    text = new_text
                    changed = True
            if not changed:
                break

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

        clean_positive = raw_positive
        clean_negative = raw_negative

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

        # Determine cycle index for {seq:...} / {cycle:...}
        node_key = str(unique_id) if unique_id is not None else "default"
        current_cycle = ModusFlowTextEditor._cycle_counters.get(node_key, 0)
        ModusFlowTextEditor._cycle_counters[node_key] = current_cycle + 1
        effective_cycle = actual_seed if seed_action == "increment" else current_cycle

        # Environment & Workflow Macros (%seed%, %date%, %time%, %sampler%, etc.)
        now = time.localtime()
        macros = {
            "%seed%": str(actual_seed),
            "%date%": time.strftime("%Y-%m-%d", now),
            "%time%": time.strftime("%H:%M:%S", now),
            "%timestamp%": time.strftime("%Y%m%d_%H%M%S", now),
            "%year%": time.strftime("%Y", now),
            "%month%": time.strftime("%m", now),
            "%day%": time.strftime("%d", now),
        }

        # Inspect workflow metadata for sampler/latent parameters if available
        if extra_pnginfo and isinstance(extra_pnginfo, dict) and "workflow" in extra_pnginfo:
            nodes_list = extra_pnginfo["workflow"].get("nodes", [])
            for n in nodes_list:
                ntype = n.get("type", "")
                wvals = n.get("widgets_values", [])
                if "KSampler" in ntype and isinstance(wvals, list):
                    for v in wvals:
                        if isinstance(v, str) and v in ("euler", "euler_ancestral", "dpmpp_2m", "dpmpp_sde", "ddim", "uni_pc"):
                            macros["%sampler%"] = v
                        elif isinstance(v, str) and v in ("normal", "karras", "exponential", "sgm_uniform"):
                            macros["%scheduler%"] = v
                    for v in wvals:
                        if isinstance(v, int) and 1 <= v <= 200 and "%steps%" not in macros:
                            macros["%steps%"] = str(v)
                        elif isinstance(v, float) and 0.5 <= v <= 30.0 and "%cfg%" not in macros:
                            macros["%cfg%"] = str(v)
                elif ("Latent" in ntype or "EmptyLatent" in ntype) and isinstance(wvals, list):
                    for v in wvals:
                        if isinstance(v, int) and v in (512, 768, 832, 1024, 1152, 1280, 1344, 1536, 1920):
                            if "%width%" not in macros:
                                macros["%width%"] = str(v)
                            elif "%height%" not in macros:
                                macros["%height%"] = str(v)

        for m_key, m_val in macros.items():
            clean_positive = clean_positive.replace(m_key, m_val)
            clean_negative = clean_negative.replace(m_key, m_val)

        # 4. Filter out comments
        no_comments_positive = self.filter_comments(clean_positive)
        no_comments_negative = self.filter_comments(clean_negative)

        # 5. Resolve dynamic wildcards, choices, and tag shuffles (seed-driven)
        resolved_positive = self.resolve_dynamic_prompts(no_comments_positive, seed=actual_seed, cycle_index=effective_cycle)
        resolved_negative = self.resolve_dynamic_prompts(no_comments_negative, seed=actual_seed, cycle_index=effective_cycle)

        # 5.5 Extract inline negative {!neg: ...} from positive prompt and merge with deduplication
        inline_negs = []
        def extract_neg(match):
            inline_negs.append(match.group(1).strip())
            return ""

        resolved_positive = re.sub(r'\{!neg:\s*([^{}]+)\}', extract_neg, resolved_positive, flags=re.IGNORECASE)
        resolved_positive = re.sub(r'\s*,\s*,+', ', ', resolved_positive)
        resolved_positive = re.sub(r'\s+,', ',', resolved_positive)
        resolved_positive = re.sub(r'^[,\s]+|[,\s]+$', '', resolved_positive)

        if inline_negs:
            combined_inline_neg = ", ".join(inline_negs)
            resolved_negative = self.merge_and_deduplicate_negative(resolved_negative, combined_inline_neg)

        # 6. Extract dynamic prompt LoRAs and completely strip them from output prompts
        extracted_prompt_loras, clean_positive = self.extract_prompt_loras(resolved_positive)
        output_positive = self.translate_weights(clean_positive, weight_mode)
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
                clip_positive = self.strip_lora_tags(output_positive)
                clip_negative = self.strip_lora_tags(output_negative)
                pos_cond = encoder.encode(active_clip, clip_positive)[0]
                neg_cond = encoder.encode(active_clip, clip_negative)[0]

                # Attach extracted LoRA payload and clean prompt to conditioning metadata
                if extracted_prompt_loras:
                    for chunk in pos_cond:
                        if len(chunk) > 1 and isinstance(chunk[1], dict):
                            chunk[1]["modusflow_prompt_loras"] = extracted_prompt_loras
                            chunk[1]["clean_prompt"] = clip_positive
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
