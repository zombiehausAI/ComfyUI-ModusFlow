"""
ModusFlow Function Editor Node

Provides interactive on-canvas creation, curation, editing, and management of
reusable prompt function libraries stored strictly in the saved_prompts/functions directory.
Supports @global and @private function scopes, namespace dot-notation calls,
and direct chaining into ModusFlow Text Editor.
"""

import os
import re
import json


def _get_functions_dir():
    """Retrieve the strictly isolated saved_prompts/functions directory."""
    try:
        from ..config import settings, BASE_DIR
    except Exception:
        try:
            from config import settings, BASE_DIR
        except Exception:
            BASE_DIR = os.path.dirname(os.path.dirname(__file__))
            settings = {}
    prompts_dir = settings.get('prompts_save_directory', '').strip() if isinstance(settings, dict) else ''
    if not prompts_dir:
        prompts_dir = os.path.join(BASE_DIR, 'saved_prompts')
    fn_dir = os.path.join(prompts_dir, 'functions')
    os.makedirs(fn_dir, exist_ok=True)
    return fn_dir


def _get_function_files():
    """List all available .mf and .txt files in saved_prompts/functions."""
    fn_dir = _get_functions_dir()
    files = []
    if os.path.isdir(fn_dir):
        files = [
            os.path.splitext(f)[0]
            for f in sorted(os.listdir(fn_dir))
            if (f.lower().endswith('.mf') or f.lower().endswith('.txt')) and os.path.isfile(os.path.join(fn_dir, f))
        ]
    return files if files else ["--no functions found--"]


class FunctionLib(dict):
    """
    Data structure carrying parsed function libraries across nodes.
    Supports namespaced functions ('camera.portrait') and global macros ('@portrait').
    Stringifies cleanly to combined raw script.
    """
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        if "namespaces" not in self:
            self["namespaces"] = {}
        if "globals" not in self:
            self["globals"] = {}
        if "raw_scripts" not in self:
            self["raw_scripts"] = []

    def __str__(self):
        return "\n\n".join(self.get("raw_scripts", []))


def parse_function_definitions(script_code: str, namespace: str = "default") -> dict:
    """
    Parse a script containing @global / @private decorators and fn/def macro definitions.
    
    Syntax examples:
        @global
        fn portrait($lens) = {
            close-up portrait shot on $lens, f/1.8, creamy bokeh
        };

        @private
        fn blur_helper($amount) = {
            subtle motion blur: $amount
        };

        fn wide($time) = {
            wide angle vista during $time
        };
    """
    clean_ns = re.sub(r'[^a-zA-Z0-9_]', '_', namespace.strip()) if namespace else "default"
    if not clean_ns:
        clean_ns = "default"

    namespaces = {clean_ns: {}}
    globals_dict = {}

    if not script_code or not isinstance(script_code, str):
        return {"namespaces": namespaces, "globals": globals_dict, "raw_scripts": []}

    # Helper: tokenize calls or function bodies
    # Match decorator followed by fn/def:
    # (?:\s*@(global|private)\s+)?(?:fn|def)\s+([a-zA-Z0-9_]+)\s*\(([^)]*)\)\s*=\s*
    pattern = re.compile(
        r'(?:^[ \t]*@(global|private)[ \t]*\r?\n)?[ \t]*(?:fn|def)[ \t]+([a-zA-Z0-9_]+)[ \t]*\(([^)]*)\)[ \t]*=(?![>=])[ \t]*',
        re.MULTILINE
    )

    pos = 0
    while pos < len(script_code):
        m = pattern.search(script_code, pos)
        if not m:
            break

        scope = (m.group(1) or "private").lower()  # default to private (namespaced)
        fn_name = m.group(2).strip()
        raw_params = m.group(3).strip()
        params = [p.strip().lstrip('$') for p in raw_params.split(',') if p.strip()]

        body_start = m.end()
        # Find matching brace { ... } or semicolon-terminated body
        if body_start < len(script_code) and script_code[body_start] == '{':
            depth = 1
            idx = body_start + 1
            in_quote = None
            while idx < len(script_code) and depth > 0:
                ch = script_code[idx]
                if in_quote:
                    if ch == in_quote and script_code[idx - 1] != '\\':
                        in_quote = None
                elif ch in ('"', "'"):
                    in_quote = ch
                elif ch == '{':
                    depth += 1
                elif ch == '}':
                    depth -= 1
                    if depth == 0:
                        break
                idx += 1
            body = script_code[body_start + 1:idx].strip()
            # Consume trailing optional semicolon
            end_pos = idx + 1
            while end_pos < len(script_code) and script_code[end_pos] in (' ', '\t', ';', '\r', '\n'):
                if script_code[end_pos] == ';':
                    end_pos += 1
                    break
                end_pos += 1
            pos = end_pos
        else:
            # Semicolon terminated
            m_semi = re.search(r';|\r?\n', script_code[body_start:])
            if m_semi:
                body = script_code[body_start:body_start + m_semi.start()].strip()
                pos = body_start + m_semi.end()
            else:
                body = script_code[body_start:].strip()
                pos = len(script_code)

        fn_record = {
            "params": params,
            "body": body,
            "scope": scope,
            "namespace": clean_ns
        }

        # Register in namespace: namespace.fn_name
        namespaces[clean_ns][fn_name] = fn_record

        # If @global, register in globals pool
        if scope == "global":
            globals_dict[fn_name] = fn_record

    return {
        "namespaces": namespaces,
        "globals": globals_dict,
        "raw_scripts": [script_code]
    }


class ModusFlowFunctionEditor:
    """
    Curate, view, edit, and organize reusable prompt functions, loops, and macro logic.
    Exposes functions via namespaced dot notation (e.g. camera.portrait) and global @decorators.
    """
    @classmethod
    def INPUT_TYPES(cls):
        files = _get_function_files()

        return {
            "required": {
                "function_file": (files, {"default": files[0]}),
                "namespace": ("STRING", {
                    "default": "camera",
                    "multiline": False,
                    "placeholder": "Namespace for dot notation (e.g. camera, lighting, styles)"
                }),
                "script_code": ("STRING", {
                    "multiline": True,
                    "default": (
                        "@global\n"
                        "fn portrait($lens) = {\n"
                        "    close-up portrait shot on $lens, f/1.8, creamy bokeh\n"
                        "};\n\n"
                        "@private\n"
                        "fn blur_helper($amount) = {\n"
                        "    subtle motion blur of $amount\n"
                        "};\n\n"
                        "fn wide($time) = {\n"
                        "    wide angle landscape during $time, hyper-detailed\n"
                        "};"
                    ),
                    "placeholder": "Define functions with @global or @private decorators...\n\n@global\nfn my_func($arg) = { ... };"
                }),
            },
            "optional": {
                "chain_functions": ("FUNCTION_LIB",),
            }
        }

    CATEGORY = "ModusFlow/Prompting"
    RETURN_TYPES = ("FUNCTION_LIB", "STRING")
    RETURN_NAMES = ("function_lib", "raw_script")
    FUNCTION = "process"

    def process(self, function_file, namespace, script_code, chain_functions=None):
        clean_code = script_code.strip() if script_code else ""
        ns = namespace.strip() if namespace and namespace.strip() else "default"

        # If script_code is empty and a file is selected, load from disk
        if not clean_code and function_file and function_file != "--no functions found--":
            fn_dir = _get_functions_dir()
            for ext in (".mf", ".txt"):
                cand = os.path.join(fn_dir, f"{function_file}{ext}")
                if os.path.isfile(cand):
                    try:
                        with open(cand, "r", encoding="utf-8") as f:
                            clean_code = f.read().strip()
                        break
                    except Exception as e:
                        print(f"[ModusFlow FunctionEditor] Error reading {cand}: {e}")

        # Parse local definitions
        parsed = parse_function_definitions(clean_code, namespace=ns)
        lib = FunctionLib()

        # Merge chained function libraries if connected
        if chain_functions and isinstance(chain_functions, dict):
            if "namespaces" in chain_functions:
                for c_ns, fns in chain_functions["namespaces"].items():
                    lib["namespaces"].setdefault(c_ns, {}).update(fns)
            if "globals" in chain_functions:
                lib["globals"].update(chain_functions["globals"])
            if "raw_scripts" in chain_functions:
                lib["raw_scripts"].extend(chain_functions["raw_scripts"])

        # Add this node's definitions
        for n_k, fns in parsed["namespaces"].items():
            lib["namespaces"].setdefault(n_k, {}).update(fns)
        lib["globals"].update(parsed["globals"])
        if clean_code:
            lib["raw_scripts"].append(clean_code)

        raw_combined = str(lib)
        return (lib, raw_combined)
