import json
import os
import re

# The directory where this config.py file is located
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CONFIG_FILE_PATH = os.path.join(BASE_DIR, 'config.json')

# Default configuration
DEFAULT_CONFIG = {
    "ollama_url": "http://127.0.0.1:11434",
    "ollama_model": "",
    "ollama_timeout": 120,
    "ollama_cloud_url": "",
    "ollama_cloud_api_key": "",
    "cloud_api_url": "https://openrouter.ai/api/v1",
    "cloud_api_key": "",
    "cloud_model": "deepseek/deepseek-chat",
    "civitai_api_key": "",
    "prompts_save_directory": "",  # Empty string means use default: BASE_DIR/saved_prompts
    "prompt_style": "Tags (SDXL / Pony)",
    "syntax_theme": "Modus Neon (Default)",
    "popout_font_family": "Monospace",
    "popout_font_size": 14,
    "base_model_definitions": [
        {"type": "flux", "keywords": ["flux", "flux1.5", "flux1.d", "chroma", "flux.1-schnell"]},
        {"type": "sdxl", "keywords": ["sdxl", "sd_xl"]},
        {"type": "pony", "keywords": ["pony"]},
        {"type": "sd15", "keywords": ["sd_v1", "v1-5", "sd15"]},
        {"type": "sd35", "keywords": ["sd_v3", "v3-5", "sd35"]}
    ]
}

def _clean_ollama_url(url: str) -> str:
    """Sanitize Ollama URL by removing accidental trailing dots in IP and trailing slashes."""
    if not isinstance(url, str):
        return "http://127.0.0.1:11434"
    cleaned = url.strip()
    cleaned = re.sub(r'(\d+\.\d+\.\d+\.\d+)\.(?=:|/|$)', r'\1', cleaned)
    return cleaned.rstrip('/')

def get_config():
    """
    Loads configuration from environment variables or a JSON file.
    Environment variables take precedence.
    """
    config = DEFAULT_CONFIG.copy()

    # 1. Load from config.json if it exists
    if os.path.exists(CONFIG_FILE_PATH):
        try:
            with open(CONFIG_FILE_PATH, 'r') as f:
                config.update(json.load(f))
        except (json.JSONDecodeError, TypeError) as e:
            print(f"[ModusFlow Config] Error loading config.json: {e}. Using defaults.")

    if "ollama_url" in config:
        config["ollama_url"] = _clean_ollama_url(config["ollama_url"])

    # 2. Override with environment variables
    if 'MODUSFLOW_OLLAMA_URL' in os.environ:
        config['ollama_url'] = os.environ['MODUSFLOW_OLLAMA_URL']
    if 'MODUSFLOW_OLLAMA_TIMEOUT' in os.environ:
        try:
            config['ollama_timeout'] = int(os.environ['MODUSFLOW_OLLAMA_TIMEOUT'])
            print(f"[ModusFlow Config] Loaded Ollama timeout from environment variable: {config['ollama_timeout']}s")
        except ValueError:
            print("[ModusFlow Config] Invalid MODUSFLOW_OLLAMA_TIMEOUT value; must be an integer. Using default.")
    if 'MODUSFLOW_OLLAMA_CLOUD_URL' in os.environ:
        config['ollama_cloud_url'] = os.environ['MODUSFLOW_OLLAMA_CLOUD_URL']
    if 'MODUSFLOW_OLLAMA_CLOUD_API_KEY' in os.environ:
        config['ollama_cloud_api_key'] = os.environ['MODUSFLOW_OLLAMA_CLOUD_API_KEY']
    if 'MODUSFLOW_CLOUD_API_URL' in os.environ:
        config['cloud_api_url'] = os.environ['MODUSFLOW_CLOUD_API_URL']
    if 'MODUSFLOW_CLOUD_API_KEY' in os.environ:
        config['cloud_api_key'] = os.environ['MODUSFLOW_CLOUD_API_KEY']
    if 'MODUSFLOW_CLOUD_MODEL' in os.environ:
        config['cloud_model'] = os.environ['MODUSFLOW_CLOUD_MODEL']
    if 'MODUSFLOW_CIVITAI_API_KEY' in os.environ:
        config['civitai_api_key'] = os.environ['MODUSFLOW_CIVITAI_API_KEY']
        print("[ModusFlow Config] Loaded Civitai API key from environment variable.")

    return config

# Load config once on startup
settings = get_config()

def get_prompt(prompt_name: str, default_text: str = "") -> str:
    """
    Loads a prompt from the 'prompts' directory.
    """
    prompt_path = os.path.join(BASE_DIR, 'prompts', f"{prompt_name}.txt")
    if os.path.exists(prompt_path):
        try:
            with open(prompt_path, 'r', encoding='utf-8') as f:
                return f.read().strip()
        except Exception as e:
            print(f"[ModusFlow Config] Error loading prompt '{prompt_name}': {e}")
    return default_text

def save_config(new_config: dict):
    """
    Saves the provided configuration dictionary to config.json.
    Also updates the live 'settings' object.
    """
    global settings
    try:
        cfg_to_save = dict(new_config)
        if "ollama_url" in cfg_to_save and isinstance(cfg_to_save["ollama_url"], str):
            cfg_to_save["ollama_url"] = _clean_ollama_url(cfg_to_save["ollama_url"])
        with open(CONFIG_FILE_PATH, 'w') as f:
            json.dump(cfg_to_save, f, indent=4)
        settings.update(cfg_to_save)
        print(f"[ModusFlow Config] Successfully saved configuration to {CONFIG_FILE_PATH}")
        return True
    except Exception as e:
        print(f"[ModusFlow Config] Error saving config.json: {e}")
        return False
