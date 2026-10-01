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
        
        return {
            "required": {
                "positive": ("STRING", {"default": "", "multiline": True}),
                "negative": ("STRING", {"default": "", "multiline": True}),
                "saved_prompt": (saved_prompts, {"default": saved_prompts[0] if saved_prompts else ""}),
            },
            "optional": {
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

    def process_text(self, positive, negative, saved_prompt, positive_input=None, negative_input=None, positive_embedding=None, negative_embedding=None, unique_id=None, extra_pnginfo=None):
        """Process positive and negative text inputs and return them as outputs."""
        # If connected inputs are provided, they take precedence over widget values
        raw_positive = positive_input if positive_input is not None else positive
        raw_negative = negative_input if negative_input is not None else negative

        # Filter out comments from outputs
        output_positive = self.filter_comments(raw_positive)
        output_negative = self.filter_comments(raw_negative)

        # Append embeddings to respective outputs
        if positive_embedding is not None and positive_embedding.strip():
            output_positive = f"{output_positive}, {positive_embedding}".strip(", ")
        if negative_embedding is not None and negative_embedding.strip():
            output_negative = f"{output_negative}, {negative_embedding}".strip(", ")

        # Update the node's widget values in the workflow metadata if available
        # Retain original raw text (with comments) in the saved workflow metadata
        if unique_id is not None and extra_pnginfo is not None:
            if isinstance(extra_pnginfo, dict) and "workflow" in extra_pnginfo:
                workflow = extra_pnginfo["workflow"]
                node = next(
                    (x for x in workflow["nodes"] if str(x["id"]) == str(unique_id)),
                    None,
                )
                if node:
                    node["widgets_values"] = [positive, negative, saved_prompt]

        return (output_positive, output_negative,)
