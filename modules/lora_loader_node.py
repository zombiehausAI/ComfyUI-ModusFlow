import torch
import folder_paths
import os
import json
import random
import re
from nodes import LoraLoader as CoreLoraLoader
from ..config import settings

class ModusFlowLoraLoader:
    @staticmethod
    def find_lora_path(lora_name: str, lora_paths: list[str]) -> str | None:
        """Finds a LoRA path from a given name, trying multiple case-insensitive strategies for robustness."""
        lora_name_norm = lora_name.strip().replace('\\', '/')
        lora_name_lower = lora_name_norm.lower()

        # Strategy 1: Case-insensitive exact match
        for p in lora_paths:
            if p.lower().replace('\\', '/') == lora_name_lower:
                return p

        # Strategy 2: Case-insensitive basename match
        lora_basename_lower = os.path.basename(lora_name_lower)
        for p in lora_paths:
            if os.path.basename(p.lower().replace('\\', '/')) == lora_basename_lower:
                return p

        # Strategy 3: Case-insensitive basename match without extension
        lora_basename_no_ext_lower = os.path.splitext(lora_basename_lower)[0]
        for p in lora_paths:
            p_basename_no_ext_lower = os.path.splitext(os.path.basename(p.lower().replace('\\', '/')))[0]
            if p_basename_no_ext_lower == lora_basename_no_ext_lower:
                return p

        return None

    @classmethod
    def INPUT_TYPES(cls):
        # Get base model types from config for the validation dropdown.
        try:
            # Add a "None" option for no validation
            base_model_types = ["None"] 
            definitions = settings.get("base_model_definitions", [])
            # Extract the 'type' from each definition dictionary
            base_model_types.extend([d.get("type") for d in definitions if d.get("type")])
            if len(base_model_types) == 1: # Only "None" is present
                 base_model_types.append("<no definitions in config>")
        except Exception as e:
            base_model_types = ["None", "<error loading definitions>"]

        return {
            "required": {
                # This hidden widget stores the state of the advanced list, managed by JS
                "lora_stack": ("STRING", {"default": "[]", "multiline": True, "hidden": True}),
                # This widget is for the UI to help validate LoRAs against a base model.
                "base_model_name": (base_model_types,),
            },
            "optional": {
                "pipe": ("PIPE",),
                "model": ("MODEL",),
                "clip": ("CLIP",),
                "positive": ("CONDITIONING",),
                "negative": ("CONDITIONING",),
                # Seed is a passthrough and provides deterministic random selection.
                "seed": ("INT", {"forceInput": True}),
                # Optional prompt text to dynamically detect and load <lora:name:strength> tags
                "prompt": ("STRING", {"forceInput": True, "multiline": True}),
                # This widget is for the UI only, to filter the LoRA list.
                "lora_filter": ("STRING", {"default": "", "multiline": False}),
                # This widget holds the API key, making it part of the workflow.
                "civitai_api_key": ("STRING", {"default": "", "multiline": False, "hidden": True}),
                "random_pick_count": ("INT", {"default": 1, "min": 1, "max": 10, "step": 1}),
                "auto_keyword_discovery": ("BOOLEAN", {"default": True}),
                "keyword_blacklist": ("STRING", {"default": "", "multiline": False}),
            }
        }

    @staticmethod
    def extract_lora_trigger_words(lora_file_path: str, blacklist: set[str] | None = None) -> list[str]:
        """Extracts trained trigger words from sidecar json/civitai.info or safetensors header."""
        if not lora_file_path or not os.path.isfile(lora_file_path):
            return []

        base_no_ext, _ = os.path.splitext(lora_file_path)
        blacklist_set = {b.lower().strip() for b in blacklist if b and b.strip()} if blacklist else set()

        # 1. Check sidecar files: .civitai.info or .json
        for ext in ('.civitai.info', '.json', '.info'):
            sidecar = base_no_ext + ext
            if os.path.isfile(sidecar):
                try:
                    with open(sidecar, 'r', encoding='utf-8') as f:
                        meta = json.load(f)
                        tw = meta.get("trainedWords")
                        if isinstance(tw, list) and tw:
                            words = [str(w).strip() for w in tw if str(w).strip()]
                            if blacklist_set:
                                words = [w for w in words if w.lower() not in blacklist_set]
                            return words
                except Exception:
                    pass

        # 2. Check safetensors header metadata directly (fast, zero torch overhead)
        if lora_file_path.lower().endswith(".safetensors"):
            try:
                with open(lora_file_path, 'rb') as f:
                    header_size_bytes = f.read(8)
                    if len(header_size_bytes) == 8:
                        import struct
                        header_len = struct.unpack('<Q', header_size_bytes)[0]
                        if 0 < header_len < 50 * 1024 * 1024:
                            header_json = f.read(header_len).decode('utf-8', errors='ignore')
                            meta = json.loads(header_json).get("__metadata__", {})

                            # Direct trained words or modelspec tags
                            tw = meta.get("trained_words") or meta.get("modelspec.tags")
                            if isinstance(tw, str) and tw:
                                words = [t.strip() for t in tw.split(",") if t.strip()]
                                if blacklist_set:
                                    words = [w for w in words if w.lower() not in blacklist_set]
                                return words

                            # Dataset tag frequency: extract top tags
                            tag_freq = meta.get("ss_tag_frequency")
                            if tag_freq:
                                if isinstance(tag_freq, str):
                                    try:
                                        tag_freq = json.loads(tag_freq)
                                    except Exception:
                                        pass
                                if isinstance(tag_freq, dict):
                                    all_tags = {}
                                    for ds, tags in tag_freq.items():
                                        if isinstance(tags, dict):
                                            for t, cnt in tags.items():
                                                all_tags[t] = all_tags.get(t, 0) + (cnt if isinstance(cnt, (int, float)) else 1)
                                    if all_tags:
                                        sorted_tags = sorted(all_tags.keys(), key=lambda x: all_tags[x], reverse=True)
                                        if blacklist_set:
                                            sorted_tags = [t for t in sorted_tags if t.strip().lower() not in blacklist_set]
                                        return sorted_tags[:8]
            except Exception:
                pass

        return []

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

        # Remove C-style block comments /* ... */ first so commented/muted tags are ignored
        uncommented = re.sub(r'/\*.*?\*/', '', prompt, flags=re.DOTALL)

        # Match <lora:filename:model_weight:clip_weight> or <lora:filename:weight> or <lora:filename>
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

        # Produce clean prompt: strip all <lora:[^>]+> and commented loras
        clean = re.sub(r'/\*\s*<lora:[^>]+>\s*\*/|<lora:[^>]+>', '', prompt)
        clean = re.sub(r'[ \t]+', ' ', clean)
        clean = re.sub(r'\s*,\s*,+', ', ', clean)
        clean = re.sub(r'\s+,', ',', clean)
        clean = re.sub(r'^[,\s]+|[,\s]+$', '', clean)

        return loras, clean

    RETURN_TYPES = ("MODEL", "CLIP", "CONDITIONING", "CONDITIONING", "INT", "PIPE", "STRING", "STRING", "STRING")
    RETURN_NAMES = ("model", "clip", "positive", "negative", "seed", "pipe", "loaded_loras", "trigger_words", "prompt")
    FUNCTION = "load_loras"
    CATEGORY = "ModusFlow/Loaders"

    @classmethod
    def IS_CHANGED(cls, lora_stack, **kwargs):
        try:
            items = json.loads(lora_stack)
            random_pool = [i for i in items if i.get("enabled", False) and i.get("random", False)]
            seed_val = kwargs.get("seed")
            # If there is a random pool and seed is left blank (None or 0), randomize every run
            if len(random_pool) > 1 and (seed_val is None or seed_val == 0):
                import time
                return time.time()
        except Exception:
            pass
        return False

    def load_loras(self, lora_stack, base_model_name, pipe=None, model=None, clip=None, positive=None, negative=None, lora_filter="", seed=0, civitai_api_key="", random_pick_count=1, auto_keyword_discovery=True, keyword_blacklist="", prompt=None, **kwargs):
        # Extract from pipe if provided (individual inputs override pipe)
        if pipe is not None:
            # Pipe format: (model, clip, vae, positive, negative)
            model = model if model is not None else (pipe[0] if len(pipe) > 0 else None)
            clip = clip if clip is not None else (pipe[1] if len(pipe) > 1 else None)
            vae = pipe[2] if len(pipe) > 2 else None
            positive = positive if positive is not None else (pipe[3] if len(pipe) > 3 else positive)
            negative = negative if negative is not None else (pipe[4] if len(pipe) > 4 else negative)
            # If an extended pipe has a seed at index 5 and seed input is blank, use it
            if (seed is None or seed == 0) and len(pipe) > 5 and isinstance(pipe[5], int):
                seed = pipe[5]
        else:
            vae = None
        
        # Validate that we have model and clip
        if model is None or clip is None:
            raise ValueError("MODEL and CLIP are required (provide via pipe or individual inputs)")
        
        lora_loader = CoreLoraLoader()
        lora_paths = folder_paths.get_filename_list("loras")

        # Parse prompt-tagged LoRAs (<lora:name:strength>)
        prompt_loras, clean_prompt = self.extract_prompt_loras(prompt) if prompt else ([], prompt or "")

        # If prompt was not wired directly, auto-discover from incoming positive conditioning or pipe metadata
        if not prompt_loras:
            cond_to_check = positive if (positive and isinstance(positive, (list, tuple))) else (pipe[3] if (pipe is not None and len(pipe) > 3 and pipe[3]) else None)
            if cond_to_check and isinstance(cond_to_check, (list, tuple)):
                for chunk in cond_to_check:
                    if isinstance(chunk, (list, tuple)) and len(chunk) > 1 and isinstance(chunk[1], dict):
                        meta_loras = chunk[1].get("modusflow_prompt_loras")
                        if meta_loras:
                            prompt_loras = list(meta_loras)
                            if not clean_prompt:
                                clean_prompt = chunk[1].get("clean_prompt", "")
                            break

        try:
            lora_items = json.loads(lora_stack)
            if not isinstance(lora_items, list):
                lora_items = []
        except (json.JSONDecodeError, TypeError):
            lora_items = []

        try:
            random_pick_count = int(random_pick_count)
        except (ValueError, TypeError):
            random_pick_count = 1
        if random_pick_count < 1:
            random_pick_count = 1

        enabled_loras = [item for item in lora_items if item.get("enabled", False)]

        if not enabled_loras and not prompt_loras:
            # If positive conditioning was not provided and clean_prompt is available, encode with clip
            if (positive is None or len(positive) == 0) and clean_prompt and clip is not None:
                try:
                    from nodes import CLIPTextEncode
                    encoder = CLIPTextEncode()
                    positive = encoder.encode(clip, clean_prompt)[0]
                except Exception:
                    pass
            if positive is None: positive = []
            if negative is None: negative = []
            output_pipe = (model, clip, vae, positive, negative)
            return (model, clip, positive, negative, seed, output_pipe, "No LoRAs loaded", "", clean_prompt)

        # Separate fixed vs random pool
        fixed_loras = [item for item in enabled_loras if not item.get("random", False)]
        random_pool = [item for item in enabled_loras if item.get("random", False)]

        chosen_random = []
        if random_pool:
            rng = random.Random(seed if seed is not None and seed != 0 else None)
            k = min(random_pick_count, len(random_pool))
            chosen_random = rng.sample(random_pool, k)

        # Build blacklist set from input and config
        if not keyword_blacklist and "key_blacklist" in kwargs:
            keyword_blacklist = kwargs["key_blacklist"]

        blacklist_set = set()
        config_bl = settings.get("lora_keyword_blacklist", [])
        if isinstance(config_bl, list):
            blacklist_set.update(k.strip().lower() for k in config_bl if isinstance(k, str) and k.strip())
        elif isinstance(config_bl, str) and config_bl.strip():
            blacklist_set.update(k.strip().lower() for k in config_bl.split(",") if k.strip())

        if keyword_blacklist and isinstance(keyword_blacklist, str):
            blacklist_set.update(k.strip().strip("\"'").lower() for k in keyword_blacklist.split(",") if k.strip())

        active_loras = [(item, "Fixed") for item in fixed_loras] + [(item, "Random") for item in chosen_random]
        loaded_summaries = []
        all_trigger_words = []
        applied_lora_files = set()

        for item, tag in active_loras:
            lora_name = item.get("name")
            if not lora_name:
                continue

            lora_file = self.find_lora_path(lora_name, lora_paths)
            if lora_file:
                applied_lora_files.add(lora_file.lower().replace('\\', '/'))
                if auto_keyword_discovery:
                    full_lora_path = folder_paths.get_full_path("loras", lora_file)
                    if full_lora_path:
                        triggers = self.extract_lora_trigger_words(full_lora_path, blacklist=blacklist_set)
                        for t in triggers:
                            if (not blacklist_set or t.strip().lower() not in blacklist_set) and t not in all_trigger_words:
                                all_trigger_words.append(t)

                strength = item.get("strength", 1.0)
                if strength == 0:
                    continue

                try:
                    model, clip = lora_loader.load_lora(model, clip, lora_file, strength, strength)
                    loaded_summaries.append(f"[{tag}] {lora_name} (strength: {strength:g})")
                except Exception as e:
                    pass

        # Apply prompt-tagged LoRAs (<lora:name:strength>)
        for p_item in prompt_loras:
            lora_name = p_item.get("name")
            if not lora_name:
                continue

            lora_file = self.find_lora_path(lora_name, lora_paths)
            if lora_file:
                lora_key = lora_file.lower().replace('\\', '/')
                # Avoid duplicate application if already loaded in this run
                if lora_key in applied_lora_files:
                    continue
                applied_lora_files.add(lora_key)

                if auto_keyword_discovery:
                    full_lora_path = folder_paths.get_full_path("loras", lora_file)
                    if full_lora_path:
                        triggers = self.extract_lora_trigger_words(full_lora_path, blacklist=blacklist_set)
                        for t in triggers:
                            if (not blacklist_set or t.strip().lower() not in blacklist_set) and t not in all_trigger_words:
                                all_trigger_words.append(t)

                m_strength = p_item.get("model_strength", 1.0)
                c_strength = p_item.get("clip_strength", m_strength)
                if m_strength == 0 and c_strength == 0:
                    continue

                try:
                    model, clip = lora_loader.load_lora(model, clip, lora_file, m_strength, c_strength)
                    if m_strength == c_strength:
                        loaded_summaries.append(f"[Prompt] {lora_name} (strength: {m_strength:g})")
                    else:
                        loaded_summaries.append(f"[Prompt] {lora_name} (model: {m_strength:g}, clip: {c_strength:g})")
                except Exception as e:
                    pass
            else:
                loaded_summaries.append(f"[Prompt] {lora_name} (NOT FOUND on disk)")

        # If prompt LoRAs were applied, or if positive conditioning was not provided, encode clean_prompt with modified clip
        if (bool(prompt_loras) or positive is None or len(positive) == 0) and clean_prompt and clip is not None:
            try:
                from nodes import CLIPTextEncode
                encoder = CLIPTextEncode()
                positive = encoder.encode(clip, clean_prompt)[0]
            except Exception:
                pass

        # Ensure conditioning outputs are valid lists, not None
        if positive is None: positive = []
        if negative is None: negative = []
        
        output_pipe = (model, clip, vae, positive, negative)
        lora_summary_text = "\n".join(loaded_summaries) if loaded_summaries else "No LoRAs loaded"
        trigger_words_str = ", ".join(all_trigger_words)
        return (model, clip, positive, negative, seed, output_pipe, lora_summary_text, trigger_words_str, clean_prompt)

NODE_CLASS_MAPPINGS = {
    "ModusFlowLoraLoader": ModusFlowLoraLoader
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "ModusFlowLoraLoader": "ModusFlow LoRA Loader"
}
