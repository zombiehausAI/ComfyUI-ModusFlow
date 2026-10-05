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
    def strip_lora_tags(text: str) -> str:
        """Strip <lora:filename:1.0> or <lora:filename> so raw angle brackets do not pollute prompts."""
        if not text or not isinstance(text, str):
            return ""
        return re.sub(r'<lora:[^>]+>', '', text)

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
        - Synced Tuples ([$hero, $color] = { [knight, silver] | [mage, violet] };)
        - Variables ($color = {red|blue}; ... $color | filter)
        - Sequential & Cycling choices ({seq: a|b|c}, {cycle: a|b|c})
        - Random Numerical Ranges ({range: 18..35}, {range: 0.8..1.4:0.05})
        - Conditionals (CASE statements and Ternaries)
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

        # 1. Sequentially resolve all variable definitions top-to-bottom
        variables = dict(initial_vars) if initial_vars else {}
        out_chars = []
        ti = 0
        tn = len(text)
        depth = 0
        while ti < tn:
            if depth == 0:
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

        # 2. Resolve Ternary Conditionals: {$var==val?true:false}, {$var!=val?...}, {$var?true:false}
        def eval_condition(var_val, op, target):
            var_val = "" if var_val is None else str(var_val).strip()
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
                is_var_prefix = input_text[i:i+2] == "{$"
                if is_var_prefix or m_case_pre:
                    start = i
                    i += m_case_pre.end() if m_case_pre else 2
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
                                    for vn, vv in variables.items():
                                        eval_target = re.sub(rf'\${vn}\b', str(vv), eval_target)
                                    if "{" in eval_target or "|" in eval_target:
                                        eval_target = ModusFlowTextEditor.resolve_dynamic_prompts(eval_target, seed=seed, cycle_index=cycle_index, initial_vars=variables)
                                    var_val = eval_target.strip()

                                # Split cases_part by '|' at depth 0, ensuring '|' is a branch separator (followed by '=>')
                                branches = []
                                cur_b = []
                                d = 0
                                cp_len = len(cases_part)
                                for c_idx, ch in enumerate(cases_part):
                                    if ch == "{":
                                        d += 1
                                        cur_b.append(ch)
                                    elif ch == "}":
                                        d -= 1
                                        cur_b.append(ch)
                                    elif ch == "|" and d == 0:
                                        # Check if this '|' separates a branch (has '=>' ahead at depth 0 before the next '|')
                                        has_arrow_ahead = False
                                        sub_d = 0
                                        for f_idx in range(c_idx + 1, cp_len):
                                            f_ch = cases_part[f_idx]
                                            if f_ch == "{": sub_d += 1
                                            elif f_ch == "}": sub_d -= 1
                                            elif sub_d == 0:
                                                if f_ch == "|":
                                                    break
                                                if cases_part[f_idx:f_idx+2] == "=>":
                                                    has_arrow_ahead = True
                                                    break
                                        if has_arrow_ahead:
                                            branches.append("".join(cur_b).strip())
                                            cur_b = []
                                        else:
                                            cur_b.append(ch)
                                    else:
                                        cur_b.append(ch)
                                if cur_b:
                                    branches.append("".join(cur_b).strip())

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
                            if c == "{": d += 1
                            elif c == "}": d -= 1
                            elif c == "?" and d == 0:
                                q_idx = idx
                                break

                        if q_idx != -1:
                            cond_part = inner[:q_idx].strip()
                            rest = inner[q_idx+1:]
                            colon_idx = -1
                            d = 0
                            for idx, c in enumerate(rest):
                                if c == "{": d += 1
                                elif c == "}": d -= 1
                                elif c == ":" and d == 0:
                                    colon_idx = idx
                                    break

                            if colon_idx != -1:
                                true_b = rest[:colon_idx].strip()
                                false_b = rest[colon_idx+1:].strip()
                            else:
                                true_b = rest.strip()
                                false_b = ""

                            m = re.match(r"^[$]?([a-zA-Z0-9_]+)(?:\s*(==|!=|>=|<=|>|<|not\s+in|in)\s*(.*))?$", cond_part, re.IGNORECASE)
                            if m:
                                var_name = m.group(1)
                                op = m.group(2)
                                target = (m.group(3) or "").strip()
                                var_val = variables.get(var_name, "")
                                is_true = eval_condition(var_val, op, target)
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

        # Substitute defined variables with optional filters ($varname | filter)
        def apply_filter(val: str, filter_expr: str) -> str:
            filter_expr = filter_expr.strip()
            f_name = filter_expr.lower()
            arg = None
            m_call = re.match(r'^([a-zA-Z0-9_]+)\((.*)\)$', filter_expr)
            if m_call:
                f_name = m_call.group(1).lower()
                arg = m_call.group(2).strip().strip("'\"")

            if f_name == "upper":
                return val.upper()
            elif f_name == "lower":
                return val.lower()
            elif f_name == "title":
                return val.title()
            elif f_name == "capitalize":
                return val.capitalize()
            elif f_name == "trim":
                return val.strip()
            elif f_name == "weight":
                w = arg if arg else "1.2"
                return f"({val}:{w})"
            elif f_name == "wrap":
                parts = [p.strip().strip("'\"") for p in (arg or "").split(",") if p.strip()]
                prefix = parts[0] if len(parts) > 0 else "("
                suffix = parts[1] if len(parts) > 1 else ")"
                return f"{prefix}{val}{suffix}"
            elif f_name == "default":
                return val if val.strip() else (arg or "")
            return val

        # 1. Match piped variable calls: $var | filter1 | filter2
        for var_name, var_val in variables.items():
            pipe_pattern = rf'\${var_name}\s*\|\s*([a-zA-Z0-9_]+(?:\([^)]*\))?(?:\s*\|\s*[a-zA-Z0-9_]+(?:\([^)]*\))?)*)'
            def replace_piped(m):
                res = var_val
                filters = m.group(1).split('|')
                for f in filters:
                    res = apply_filter(res, f)
                return res
            text = re.sub(pipe_pattern, replace_piped, text)

        # 2. Match standard $varname substitutions
        for var_name, var_val in variables.items():
            text = re.sub(rf'\${var_name}\b', var_val, text)

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

        # 3 & 4. Iteratively resolve choices and wildcards (up to 10 passes)
        # This guarantees:
        # - Wildcard list rows can contain choices like `wearing {red|blue} sneakers`
        # - Dynamic choices can select between wildcards like `{__hats__|__helmets__}`
        # - Nested choices `{a|{b|c}}` resolve from inside out
        # - Recursive wildcards resolve cleanly
        choice_pattern = r'\{([^{}]+)\}'
        wc_pattern = r'__(?:([0-9]+(?:-[0-9]+)?)\$\$)?([a-zA-Z0-9_\-]+)__'

        for _ in range(10):
            changed = False
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
                clip_positive = self.strip_lora_tags(output_positive)
                clip_negative = self.strip_lora_tags(output_negative)
                pos_cond = encoder.encode(active_clip, clip_positive)[0]
                neg_cond = encoder.encode(active_clip, clip_negative)[0]
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
