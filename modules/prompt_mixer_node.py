"""
ModusFlow Prompt Mixer Node

A modular prompt stacker and layer mixer that allows building prompts from
independent layers (Subject, Outfit, Environment, Lighting, Style) with
per-slot bypass toggles, custom prefixes, delimiters, and pipe awareness.
"""

import re


class ModusFlowPromptMixer:
    """
    Mix, stack, and audition modular prompt layers with independent bypass switches.
    """

    @classmethod
    def INPUT_TYPES(cls):
        delimiters = [", ", " | ", " - ", "\n", " "]

        return {
            "required": {
                "delimiter": (delimiters, {"default": ", "}),
                "clean_punctuation": ("BOOLEAN", {"default": True}),

                # Slot 1: Primary Subject
                "slot1_enabled": ("BOOLEAN", {"default": True}),
                "slot1_text": ("STRING", {"default": "1girl, solo, portrait", "multiline": True}),
                "slot1_prefix": ("STRING", {"default": ""}),

                # Slot 2: Outfit & Accessories
                "slot2_enabled": ("BOOLEAN", {"default": True}),
                "slot2_text": ("STRING", {"default": "casual hoodie, silver earrings", "multiline": True}),
                "slot2_prefix": ("STRING", {"default": "wearing"}),

                # Slot 3: Environment & Setting
                "slot3_enabled": ("BOOLEAN", {"default": True}),
                "slot3_text": ("STRING", {"default": "neon city street, rainy night reflections", "multiline": True}),
                "slot3_prefix": ("STRING", {"default": "standing in"}),

                # Slot 4: Lighting & Atmosphere
                "slot4_enabled": ("BOOLEAN", {"default": True}),
                "slot4_text": ("STRING", {"default": "cinematic rim lighting, volumetric fog", "multiline": True}),
                "slot4_prefix": ("STRING", {"default": "illuminated by"}),

                # Slot 5: Camera, Aesthetics & Quality
                "slot5_enabled": ("BOOLEAN", {"default": True}),
                "slot5_text": ("STRING", {"default": "8k resolution, 35mm film photography, masterpiece", "multiline": True}),
                "slot5_prefix": ("STRING", {"default": "captured on"}),
            },
            "optional": {
                "pipe": ("PIPE",),
                "slot1_in": ("STRING", {"forceInput": True}),
                "slot2_in": ("STRING", {"forceInput": True}),
                "slot3_in": ("STRING", {"forceInput": True}),
                "slot4_in": ("STRING", {"forceInput": True}),
                "slot5_in": ("STRING", {"forceInput": True}),
                "base_prompt": ("STRING", {"forceInput": True}),
            },
        }

    RETURN_TYPES = ("STRING", "PIPE",)
    RETURN_NAMES = ("prompt", "pipe",)
    FUNCTION = "mix_prompts"
    CATEGORY = "ModusFlow/Utilities"

    def mix_prompts(self, delimiter=", ", clean_punctuation=True,
                    slot1_enabled=True, slot1_text="", slot1_prefix="",
                    slot2_enabled=True, slot2_text="", slot2_prefix="",
                    slot3_enabled=True, slot3_text="", slot3_prefix="",
                    slot4_enabled=True, slot4_text="", slot4_prefix="",
                    slot5_enabled=True, slot5_text="", slot5_prefix="",
                    pipe=None, slot1_in=None, slot2_in=None, slot3_in=None,
                    slot4_in=None, slot5_in=None, base_prompt=None):
        parts = []

        if base_prompt and str(base_prompt).strip():
            parts.append(str(base_prompt).strip())

        slots = [
            (slot1_enabled, slot1_in if slot1_in is not None else slot1_text, slot1_prefix),
            (slot2_enabled, slot2_in if slot2_in is not None else slot2_text, slot2_prefix),
            (slot3_enabled, slot3_in if slot3_in is not None else slot3_text, slot3_prefix),
            (slot4_enabled, slot4_in if slot4_in is not None else slot4_text, slot4_prefix),
            (slot5_enabled, slot5_in if slot5_in is not None else slot5_text, slot5_prefix),
        ]

        for enabled, content, prefix in slots:
            if not enabled:
                continue
            text = str(content).strip() if content is not None else ""
            if not text:
                continue

            if prefix and prefix.strip():
                p_clean = prefix.strip()
                # Don't duplicate prefix if user already typed it
                if not text.lower().startswith(p_clean.lower()):
                    text = f"{p_clean} {text}"

            parts.append(text)

        joined = delimiter.join(parts).strip()

        if clean_punctuation:
            # Clean duplicate commas and spaces
            joined = re.sub(r',\s*,+', ', ', joined)
            joined = re.sub(r'^[,\s]+', '', joined)
            joined = re.sub(r'[,\s]+$', '', joined)
            joined = re.sub(r'[ \t]+', ' ', joined)

        # Pipe pass-through: if pipe exists, we can encode positive or pass pipe
        output_pipe = pipe
        return (joined, output_pipe)
