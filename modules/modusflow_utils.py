import html
import json
import re
import urllib.parse
import urllib.request
import requests
from ..config import settings

_ollama_models = []
_fetched_from_url = None

def get_ollama_models(ollama_url, force_refresh=False, api_key=None):
    global _ollama_models
    global _fetched_from_url

    if not force_refresh and _ollama_models and _fetched_from_url == ollama_url:
        return _ollama_models

    _fetched_from_url = ollama_url
    headers = {}
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"

    try:
        timeout_val = settings.get('ollama_timeout', 120)
        response = requests.get(f"{ollama_url}/api/tags", headers=headers, timeout=timeout_val)
        response.raise_for_status()
        models_data = response.json().get("models", [])
        _ollama_models = sorted([model["name"] for model in models_data])
        if not _ollama_models:
            _ollama_models = ["ollama-no-models-found"]
    except requests.exceptions.RequestException as e:
        _ollama_models = ["ollama-not-running"]
    except Exception as e:
        _ollama_models = ["ollama-not-running"]
    return _ollama_models

def perform_web_search(query: str, max_results: int = 4) -> str:
    """
    Performs a lightweight web search using DuckDuckGo HTML without external API keys.
    Returns cleaned factual excerpts to enrich LLM prompt context.
    """
    clean_query = query.strip()
    if not clean_query:
        return ""

    try:
        post_data = urllib.parse.urlencode({'q': clean_query}).encode('utf-8')
        req = urllib.request.Request(
            'https://html.duckduckgo.com/html/',
            data=post_data,
            headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'}
        )
        with urllib.request.urlopen(req, timeout=12) as resp:
            page_html = resp.read().decode('utf-8', errors='ignore')

        snippets = re.findall(r'class="result__snippet"[^>]*>(.*?)</a>', page_html, re.DOTALL)
        if not snippets:
            snippets = re.findall(r'result__snippet[^>]*>(.*?)<', page_html, re.DOTALL)

        extracted = []
        for s in snippets[:max_results]:
            text = re.sub(r'<[^>]+>', '', s)
            text = html.unescape(text).strip()
            if text and len(text) > 20:
                extracted.append(f"- {text}")

        if extracted:
            return "\n".join(extracted)
    except Exception as e:
        print(f"[ModusFlow Search] Web search notice: {e}")

    return ""

def query_llm(provider: str, model: str, system_prompt: str, user_prompt: str,
              temperature: float = 0.7, max_tokens: int = 2048, seed: int = 0) -> str:
    """
    Unified LLM query handler supporting:
      - 'Ollama (Local)': Local Ollama instance
      - 'Ollama (Cloud)': Remote / Cloud Ollama instance with optional Bearer token
      - 'Cloud (OpenAI / OpenRouter / Groq / DeepSeek)': Standard OpenAI-compatible chat completions
    """
    timeout_val = settings.get('ollama_timeout', 120)

    # 1. Ollama (Local or Cloud)
    if provider in ("Ollama (Local)", "Ollama (Cloud)"):
        if provider == "Ollama (Cloud)":
            base_url = settings.get('ollama_cloud_url', '').strip()
            api_key = settings.get('ollama_cloud_api_key', '').strip()
            if not base_url:
                raise ValueError("Ollama Cloud URL is not configured in settings/config.json")
        else:
            base_url = settings.get('ollama_url', 'http://127.0.0.1:11434').strip()
            api_key = ""

        if model.startswith("ollama-not-running") or model.startswith("ollama-no-models-found"):
            raise RuntimeError(f"Ollama server at '{base_url}' is not accessible or has no models installed.")

        api_url = f"{base_url.rstrip('/')}/api/chat"
        headers = {}
        if api_key:
            headers["Authorization"] = f"Bearer {api_key}"

        payload = {
            "model": model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "stream": False,
            "options": {
                "temperature": temperature,
                "num_predict": max_tokens,
            }
        }
        if seed != 0:
            payload["options"]["seed"] = seed

        resp = requests.post(api_url, json=payload, headers=headers, timeout=timeout_val)
        resp.raise_for_status()
        data = resp.json()
        if "error" in data:
            raise RuntimeError(f"Ollama error: {data['error']}")
        return sanitize_llm_output(data.get("message", {}).get("content", ""))

    # 2. Cloud OpenAI-Compatible (OpenRouter / Groq / OpenAI / DeepSeek)
    elif provider.startswith("Cloud"):
        cloud_url = settings.get('cloud_api_url', 'https://openrouter.ai/api/v1').strip().rstrip('/')
        api_key = settings.get('cloud_api_key', '').strip()
        if not api_key:
            raise ValueError("Cloud API Key is not configured in settings/config.json or MODUSFLOW_CLOUD_API_KEY environment variable")

        if not cloud_url.endswith("/chat/completions"):
            endpoint = f"{cloud_url}/chat/completions"
        else:
            endpoint = cloud_url

        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "https://github.com/zombiehausAI/ComfyUI-ModusFlow",
            "X-Title": "ModusFlow Song Studio",
        }

        payload = {
            "model": model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        if seed != 0:
            payload["seed"] = seed

        resp = requests.post(endpoint, json=payload, headers=headers, timeout=timeout_val)
        resp.raise_for_status()
        data = resp.json()
        if "error" in data:
            raise RuntimeError(f"Cloud API error: {data['error']}")
        choices = data.get("choices", [])
        if not choices:
            raise RuntimeError("Cloud API returned no completion choices")
        return sanitize_llm_output(choices[0].get("message", {}).get("content", ""))

    else:
        raise ValueError(f"Unknown AI provider: {provider}")

def sanitize_llm_output(text: str) -> str:
    sanitized_text = text.strip()
    if sanitized_text.startswith("```json") and sanitized_text.endswith("```"):
        sanitized_text = sanitized_text[7:-3].strip()
    elif sanitized_text.startswith("```") and sanitized_text.endswith("```"):
        sanitized_text = sanitized_text[3:-3].strip()
    if (sanitized_text.startswith('"') and sanitized_text.endswith('"')) or \
       (sanitized_text.startswith("'") and sanitized_text.endswith("'")):
        sanitized_text = sanitized_text[1:-1].strip()
    sanitized_text = re.sub(r'^[^:\n]*prompt[^:\n]*:\s*', '', sanitized_text, count=1, flags=re.IGNORECASE).strip()
    return sanitized_text

