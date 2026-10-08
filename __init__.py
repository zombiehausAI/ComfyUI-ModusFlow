from .modules.ollama_prompt_refiner_node import OllamaPromptRefinerNode
from .modules.ollama_text_refiner_node import OllamaTextRefinerNode
from .modules.image_for_prompting_node import ModusFlowImageForPromptingNode
from .modules.modusflow_utils import get_ollama_models
from .modules.batch_ksampler_node import ModusFlowBatchKSampler
from .modules.lora_loader_node import ModusFlowLoraLoader
from .modules.upscaler_node import ModusFlowUpscaler
from .modules.ksampler_node import ModusFlowKSampler
from .modules.model_loader_node import ModusFlowModelLoader
from .modules.multi_clip_text_encode_node import ModusFlowMultiCLIPTextEncode
from .modules.show_text_node import ModusFlowShowText
from .modules.text_editor_node import ModusFlowTextEditor
from .modules.image_gallery_node import ModusFlowImageGallery
from .modules.latent_preset_node import ModusFlowLatentPreset
from .modules.save_audio_node import ModusFlowSaveAudio
from .modules.save_image_node import ModusFlowSaveImage
from .modules.ace_step_audio_node import ModusFlowAceStepAudio
from .modules.allinone_detailer_node import ModusFlowDetailerSlot, ModusFlowAllInOneDetailer
from .modules.conditioning_concat_node import ModusFlowConditioningConcat
from .modules.restormer_node import ModusFlowRestormer
from .modules.dynamic_guidance_node import ModusDynamicGuidance
from .modules.dewax_texture_restore_node import ModusDeWaxTextureRestore
from .modules.video_latent_node import ModusFlowVideoLatent
from .modules.save_video_node import ModusFlowSaveVideo
from .modules.song_writer_node import ModusFlowSongWriter
from .modules.audio_mixer_node import ModusFlowAudioMixer
from .modules.vae_encode_node import (
    ModusFlowLoadImage,
    ModusFlowVAEEncode,
    ModusFlowVAEDecode,
    ModusFlowFidelityController,
    ModusFlowImg2ImgVAEEncode,
)
from .modules.controlnet_node import ModusFlowControlNetLoader, ModusFlowControlNetApply, ModusFlowControlNetAllInOne
from .modules.latent_tools_node import ModusFlowLatentUpscale, ModusFlowMaskTools
from .modules.image_compare_node import ModusFlowCompareImages
from .modules.list_curator_node import ModusFlowListCurator
from .modules.model_upscale_node import ModusFlowModelUpscale
from .modules.chroma_shift_node import ModusFlowChromaShift
from .modules.prompt_mixer_node import ModusFlowPromptMixer
from .modules.seed_controller_node import ModusFlowSeedController
from .modules.controlnet_preprocessor_node import ModusFlowImagePreprocessor
from .modules.smart_resizer_node import ModusFlowSmartResizer
from .modules.faceswap_node import ModusFlowFaceSwap
from .modules.glamour_controller_node import ModusFlowGlamourController
import server
from aiohttp import web
import folder_paths
from urllib.parse import quote
from .config import settings, save_config
import safetensors.torch
import hashlib
import requests
import json
import os
import re
from PIL import Image
from PIL.PngImagePlugin import PngInfo

def sanitize_ollama_url(url: str) -> str:
    """Sanitizes Ollama URL: strips whitespace, trailing slashes, and fixes trailing dots in IP/host."""
    if not url or not isinstance(url, str):
        return "http://127.0.0.1:11434"
    clean = url.strip().rstrip("/")
    clean = re.sub(r'(\d+\.\d+\.\d+\.\d+)\.(?=:|/|$)', r'\1', clean)
    clean = re.sub(r'([a-zA-Z0-9_-]+)\.(?=:)', r'\1', clean)
    if not clean.startswith("http://") and not clean.startswith("https://"):
        clean = f"http://{clean}"
    return clean

@server.PromptServer.instance.routes.get("/modusflow/refresh_ollama_models")
async def refresh_ollama_models(request):
    """API endpoint to force a refresh of the Ollama models list."""
    ollama_url = sanitize_ollama_url(settings.get('ollama_url'))
    try:
        models = get_ollama_models(ollama_url, force_refresh=True)
        if models == ["ollama-not-running"] and "127.0.0.1" not in ollama_url:
            fb_models = get_ollama_models("http://127.0.0.1:11434", force_refresh=True)
            if fb_models != ["ollama-not-running"]:
                models = fb_models
        return web.json_response({"success": True, "data": models})
    except Exception as e:
        msg = f"API Error refreshing Ollama models: {e}"
        print(f"[ModusFlow] {msg}")
        return web.json_response({"success": False, "message": msg})

@server.PromptServer.instance.routes.get("/modusflow/ollama_status")
async def ollama_status(request):
    """Check to see if Ollama is accessible with URL sanitization and fallback."""
    raw_url = settings.get('ollama_url', 'http://127.0.0.1:11434')
    ollama_url = sanitize_ollama_url(raw_url)
    timeout_val = 3.5

    urls_to_try = [ollama_url]
    if "127.0.0.1" not in ollama_url and "localhost" not in ollama_url:
        urls_to_try.append("http://127.0.0.1:11434")

    last_error = None
    for target_url in urls_to_try:
        try:
            response = requests.get(f"{target_url}/api/tags", timeout=timeout_val)
            if response.status_code == 200:
                data = response.json()
                raw_models = data.get("models", [])
                models = sorted([m["name"] for m in raw_models if "name" in m])
                return web.json_response({
                    "success": True,
                    "available": True,
                    "models": models,
                    "url": target_url
                })
        except Exception as e:
            last_error = str(e)
            print(f"[ModusFlow Ollama Status] Connection to {target_url} failed: {e}")

    return web.json_response({
        "success": True,
        "available": False,
        "models": [],
        "tested_url": ollama_url,
        "error": last_error
    })

@server.PromptServer.instance.routes.post("/modusflow/enhance_prompt")
async def enhance_prompt(request):
    """Enhance a prompt with sensory, lighting, and atmospheric details using Ollama."""
    try:
        body = await request.json()
        prompt_text = body.get("prompt", "").strip()
        model = body.get("model", "").strip()
        style = body.get("style", "tags").strip().lower()

        if not prompt_text:
            return web.json_response({"success": False, "message": "Prompt is empty"})

        ollama_url = sanitize_ollama_url(settings.get('ollama_url', 'http://127.0.0.1:11434'))
        timeout_val = settings.get('ollama_timeout', 60)

        # Fallback to first available model if none provided
        if not model:
            for test_url in [ollama_url, "http://127.0.0.1:11434"]:
                try:
                    tags_resp = requests.get(f"{test_url}/api/tags", timeout=3.0)
                    if tags_resp.status_code == 200:
                        models_list = tags_resp.json().get("models", [])
                        if models_list:
                            model = models_list[0].get("name", "")
                            ollama_url = test_url
                            break
                except Exception:
                    pass

        if not model:
            return web.json_response({"success": False, "message": "No Ollama model specified or available"})

        if "expression" in style:
            system_prompt = (
                "You are an expert AI prompt engineer specializing in modern natural language diffusion models (FLUX.1, SD3, Midjourney). "
                "Your task is to enrich and enhance the user's prompt into a vivid, descriptive natural English paragraph (fluent sentences). "
                "Describe the subject, environment, lighting, camera angle, textures, and sensory nuances in rich natural prose without using comma tag soup or attention weights like (word:1.2). "
                "Maintain the core subject and intent of the original prompt. "
                "Return ONLY the enhanced prompt as natural descriptive sentences. "
                "Do NOT include explanations, quotes, preambles, or markdown formatting."
            )
        else:
            system_prompt = (
                "You are an expert AI prompt engineer specializing in tag-based visual image models (SDXL, Pony Diffusion, Illustrious, Anime/Danbooru). "
                "Your task is to enrich and enhance the user's prompt by adding vivid, high-quality visual keyword tags. "
                "Maintain the core subject and intent of the original prompt. "
                "Return ONLY the enhanced prompt as a clean comma-separated list of descriptive visual tags (e.g. 1girl, solo, masterpiece, cinematic lighting, detailed background). "
                "Do NOT include explanations, quotes, preambles, or markdown formatting."
            )

        payload = {
            "model": model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"Enrich this prompt: {prompt_text}"}
            ],
            "stream": False,
            "options": {
                "temperature": 0.7,
                "num_predict": 300
            }
        }

        response = requests.post(f"{ollama_url}/api/chat", json=payload, timeout=timeout_val)
        response.raise_for_status()
        data = response.json()
        raw_content = data.get("message", {}).get("content", "").strip()

        # Clean markdown wrappers or quotes
        cleaned = re.sub(r"^```(?:markdown|text)?\n?", "", raw_content, flags=re.IGNORECASE)
        cleaned = re.sub(r"\n?```$", "", cleaned).strip()
        cleaned = cleaned.strip('"\'')

        return web.json_response({"success": True, "enhanced": cleaned, "model": model})
    except requests.exceptions.Timeout:
        return web.json_response({"success": False, "message": "Ollama request timed out"})
    except requests.exceptions.ConnectionError:
        return web.json_response({"success": False, "message": "Could not connect to Ollama server"})
    except Exception as e:
        return web.json_response({"success": False, "message": str(e)})

@server.PromptServer.instance.routes.post("/modusflow/refine_selection")
async def refine_selection(request):
    """Refine a selected phrase or word using Ollama with targeted actions."""
    try:
        body = await request.json()
        selected_text = body.get("text", "").strip()
        action = body.get("action", "expand").strip().lower()
        context = body.get("context", "").strip()
        model = body.get("model", "").strip()
        style = body.get("style", "tags").strip().lower()

        if not selected_text:
            return web.json_response({"success": False, "message": "No text selected"})

        ollama_url = sanitize_ollama_url(settings.get('ollama_url', 'http://127.0.0.1:11434'))
        timeout_val = settings.get('ollama_timeout', 60)

        # Fallback to first available model if none provided
        if not model:
            for test_url in [ollama_url, "http://127.0.0.1:11434"]:
                try:
                    tags_resp = requests.get(f"{test_url}/api/tags", timeout=3.0)
                    if tags_resp.status_code == 200:
                        models_list = tags_resp.json().get("models", [])
                        if models_list:
                            model = models_list[0].get("name", "")
                            ollama_url = test_url
                            break
                except Exception:
                    pass

        if not model:
            return web.json_response({"success": False, "message": "No Ollama model specified or available"})

        context_hint = f" Surrounding prompt context: \"{context}\"." if context else ""

        if action == "expand":
            if "expression" in style:
                system_prompt = (
                    "You are an expert AI prompt engineer. "
                    "Enrich and expand the user's selected word or phrase with evocative sensory, lighting, material, and visual details in natural descriptive English prose suitable for FLUX.1/SD3. "
                    "Do NOT use comma tag lists or numerical attention weights. "
                    "Maintain the core subject and intent. Output ONLY the replacement text without quotes or explanations."
                )
            else:
                system_prompt = (
                    "You are an expert AI prompt engineer for SDXL/Pony image generation. "
                    "Enrich the user's selected word or phrase by adding high-impact visual modifier tags. "
                    "Output ONLY the replacement text as a clean comma-separated sequence of visual keyword tags without quotes or explanations."
                )
            user_prompt = f"Expand this phrase:{context_hint} \"{selected_text}\""

        elif action in ("synonyms", "wrap_choice"):
            system_prompt = (
                "You are a creative visual vocabulary assistant for image generation prompts. "
                "Provide 4 to 5 evocative visual synonyms or alternative phrasing for the given concept. "
                "Output ONLY a clean comma-separated list of alternatives (e.g. option1, option2, option3, option4) without numbering, quotes, or conversational filler."
            )
            user_prompt = f"Provide 4-5 visual alternatives for:{context_hint} \"{selected_text}\""

        elif action == "intensify":
            system_prompt = (
                "You are an expert prompt crafter. "
                "Rephrase the user's selected text to be dramatically more intense, striking, majestic, and visually powerful. "
                "Output ONLY the intensified replacement text without quotes or explanations."
            )
            user_prompt = f"Intensify this phrase:{context_hint} \"{selected_text}\""

        elif action == "simplify":
            system_prompt = (
                "You are an expert prompt editor. "
                "Boil down the user's selected text into its most concise, essential, high-impact core visual keywords, removing redundant filler words. "
                "Output ONLY the simplified replacement text without quotes or explanations."
            )
            user_prompt = f"Simplify this phrase:{context_hint} \"{selected_text}\""

        elif action == "prosify":
            system_prompt = (
                "You are an expert prompt engineer for FLUX.1 and SD3. "
                "Rewrite the user's selected tags into a fluent, cohesive, natural English description without parentheses or weights. "
                "Output ONLY the fluent prose replacement without quotes or explanations."
            )
            user_prompt = f"Convert to natural prose:{context_hint} \"{selected_text}\""

        elif action == "tagify":
            system_prompt = (
                "You are an expert prompt engineer for SDXL and Pony Diffusion. "
                "Convert the user's selected prose into clean, comma-separated visual keyword tags. "
                "Output ONLY the comma-separated tags without quotes or explanations."
            )
            user_prompt = f"Convert to keyword tags:{context_hint} \"{selected_text}\""

        else:
            system_prompt = "Refine the user's selected image prompt phrase. Output ONLY the refined text."
            user_prompt = f"Refine this:{context_hint} \"{selected_text}\""

        payload = {
            "model": model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            "stream": False,
            "options": {
                "temperature": 0.7,
                "num_predict": 180
            }
        }

        response = requests.post(f"{ollama_url}/api/chat", json=payload, timeout=timeout_val)
        response.raise_for_status()
        data = response.json()
        raw_content = data.get("message", {}).get("content", "").strip()

        cleaned = re.sub(r"^```(?:markdown|text)?\n?", "", raw_content, flags=re.IGNORECASE)
        cleaned = re.sub(r"\n?```$", "", cleaned).strip()
        cleaned = cleaned.strip('"\'')

        # For synonyms/wrap_choice, parse into list
        options = []
        if action in ("synonyms", "wrap_choice"):
            raw_opts = re.split(r"[\n,]+", cleaned)
            for opt in raw_opts:
                t = re.sub(r"^\d+[\.\)]\s*", "", opt).strip().strip('"\'')
                if t and t.lower() != selected_text.lower():
                    options.append(t)
            if not options and cleaned:
                options = [cleaned]

        return web.json_response({
            "success": True,
            "result": cleaned,
            "options": options,
            "action": action,
            "model": model
        })
    except requests.exceptions.Timeout:
        return web.json_response({"success": False, "message": "Ollama request timed out"})
    except requests.exceptions.ConnectionError:
        return web.json_response({"success": False, "message": "Could not connect to Ollama server"})
    except Exception as e:
        return web.json_response({"success": False, "message": str(e)})

@server.PromptServer.instance.routes.get("/modusflow/gallery/list")
async def gallery_list(request):
    """API endpoint to list folders and images in the output directory."""
    try:
        subpath = request.query.get("path", "").strip()
        sort_by = request.query.get("sort", "name").strip()
        output_dir = folder_paths.get_output_directory()
        
        # Build the full path
        if subpath:
            full_path = os.path.join(output_dir, subpath)
        else:
            full_path = output_dir
            
        # Security check: ensure we're still within output directory
        full_path = os.path.normpath(full_path)
        output_dir_norm = os.path.normpath(output_dir)
        if not full_path.startswith(output_dir_norm):
            return web.json_response({"success": False, "message": "Invalid path"})
        
        if not os.path.isdir(full_path):
            return web.json_response({"success": False, "message": "Directory not found"})
        
        folders = []
        images = []
        folder_stats = {}
        image_stats = {}
        
        try:
            items = os.listdir(full_path)
            
            for item in items:
                item_path = os.path.join(full_path, item)
                try:
                    stat = os.stat(item_path)
                    
                    if os.path.isdir(item_path):
                        folders.append(item)
                        folder_stats[item] = {
                            'modified': stat.st_mtime,
                            'created': stat.st_ctime
                        }
                    elif os.path.isfile(item_path):
                        # Check if it's an image file
                        if item.lower().endswith(('.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp')):
                            images.append(item)
                            image_stats[item] = {
                                'modified': stat.st_mtime,
                                'created': stat.st_ctime,
                                'size': stat.st_size
                            }
                except (OSError, PermissionError):
                    continue
                    
        except PermissionError:
            return web.json_response({"success": False, "message": "Permission denied"})
        
        return web.json_response({
            "success": True, 
            "data": {
                "folders": folders,
                "images": images,
                "folderStats": folder_stats,
                "imageStats": image_stats
            }
        })
    except Exception as e:
        msg = f"API Error listing gallery: {e}"
        print(f"[ModusFlow Gallery] {msg}")
        return web.json_response({"success": False, "message": msg})

@server.PromptServer.instance.routes.get("/modusflow/gallery/metadata")
async def gallery_metadata(request):
    """API endpoint to get metadata from an image file."""
    try:
        filename = request.query.get("filename", "").strip()
        subpath = request.query.get("path", "").strip()
        
        if not filename:
            return web.json_response({"success": False, "message": "No filename provided"})
        
        output_dir = folder_paths.get_output_directory()
        
        # Build the full path
        if subpath:
            full_path = os.path.join(output_dir, subpath, filename)
        else:
            full_path = os.path.join(output_dir, filename)
        
        # Security check: ensure we're still within output directory
        full_path = os.path.normpath(full_path)
        output_dir_norm = os.path.normpath(output_dir)
        if not full_path.startswith(output_dir_norm):
            return web.json_response({"success": False, "message": "Invalid path"})
        
        if not os.path.isfile(full_path):
            return web.json_response({"success": False, "message": "File not found"})
        
        metadata = {}
        
        try:
            # Try to read PNG metadata
            if full_path.lower().endswith('.png'):
                with Image.open(full_path) as img:
                    # Get PNG text chunks
                    png_info = img.info
                    
                    # Common ComfyUI metadata fields
                    if 'prompt' in png_info:
                        try:
                            metadata['prompt'] = json.loads(png_info['prompt'])
                        except:
                            metadata['prompt'] = png_info['prompt']
                    
                    if 'workflow' in png_info:
                        try:
                            metadata['workflow'] = json.loads(png_info['workflow'])
                        except:
                            metadata['workflow'] = png_info['workflow']
                    
                    # Include other text chunks
                    for key, value in png_info.items():
                        if key not in ['prompt', 'workflow'] and isinstance(value, str):
                            try:
                                # Try to parse as JSON
                                metadata[key] = json.loads(value)
                            except:
                                metadata[key] = value
                    
                    # Add basic image info
                    metadata['_image_info'] = {
                        'format': img.format,
                        'mode': img.mode,
                        'size': img.size,
                        'width': img.width,
                        'height': img.height
                    }
            else:
                # For non-PNG images, just get basic info
                with Image.open(full_path) as img:
                    metadata['_image_info'] = {
                        'format': img.format,
                        'mode': img.mode,
                        'size': img.size,
                        'width': img.width,
                        'height': img.height
                    }
                    
                    # Try to get EXIF data
                    if hasattr(img, '_getexif') and img._getexif():
                        metadata['exif'] = img._getexif()
        
        except Exception as e:
            print(f"[ModusFlow Gallery] Error reading metadata from {filename}: {e}")
            return web.json_response({"success": False, "message": f"Error reading metadata: {str(e)}"})
        
        # Add file info
        file_stat = os.stat(full_path)
        metadata['_file_info'] = {
            'filename': filename,
            'size_bytes': file_stat.st_size,
            'size_mb': round(file_stat.st_size / (1024 * 1024), 2),
            'modified': file_stat.st_mtime,
            'created': file_stat.st_ctime
        }
        
        return web.json_response({"success": True, "metadata": metadata})
    except Exception as e:
        msg = f"API Error getting metadata: {e}"
        print(f"[ModusFlow Gallery] {msg}")
        return web.json_response({"success": False, "message": msg})

@server.PromptServer.instance.routes.get("/modusflow/refresh_input_files")
async def refresh_input_files(request):
    """API endpoint to get an updated list of images and folders from the input directory."""
    try:
        input_dir = folder_paths.get_input_directory()
        all_items = []
        if os.path.isdir(input_dir):
            folder_items = []
            file_items = []
            for dirpath, dirnames, filenames in os.walk(input_dir, topdown=True):
                dirnames.sort()
                filenames.sort()
                for dirname in dirnames:
                    relative_path = os.path.relpath(os.path.join(dirpath, dirname), input_dir)
                    folder_items.append(f"[FOLDER] {relative_path.replace(os.sep, '/')}")
                for filename in filenames:
                    if filename.lower().endswith(('.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp')):
                        relative_path = os.path.relpath(os.path.join(dirpath, filename), input_dir)
                        file_items.append(relative_path.replace(os.sep, '/'))
            all_items = folder_items + file_items

        if not all_items:
            all_items.append("--no items found--")
        return web.json_response({"success": True, "data": all_items})
    except Exception as e:
        msg = f"API Error refreshing input file list: {e}"
        print(f"[ModusFlow] {msg}")
        return web.json_response({"success": False, "message": msg})

@server.PromptServer.instance.routes.get("/modusflow/get_loras")
async def get_loras(request):
    """API endpoint to get a list of all available LoRA models."""
    try:
        lora_list = sorted(folder_paths.get_filename_list("loras"))
        return web.json_response({"success": True, "data": lora_list})
    except Exception as e:
        msg = f"API Error getting LoRA list: {e}"
        print(f"[ModusFlow LoRA Loader] {msg}")
        return web.json_response({"success": False, "message": msg})

@server.PromptServer.instance.routes.post("/modusflow/save_civitai_key")
async def save_civitai_key_endpoint(request):
    """API endpoint to save the Civitai API key to the config file."""
    try:
        data = await request.json()
        api_key = data.get("api_key", "")

        current_config = settings.copy()
        current_config["civitai_api_key"] = api_key

        if save_config(current_config):
            return web.json_response({"success": True, "message": "API key saved successfully."})
        else:
            msg = "Failed to write to config file. Check permissions."
            print(f"[ModusFlow] {msg}")
            return web.json_response({"success": False, "message": msg})
    except Exception as e:
        msg = f"Error saving Civitai API key: {e}"
        print(f"[ModusFlow] {msg}")
        return web.json_response({"success": False, "message": msg})

@server.PromptServer.instance.routes.get("/modusflow/get_config")
async def get_config_endpoint(request):
    """API endpoint to get the current ModusFlow configuration."""
    try:
        from .config import settings, DEFAULT_CONFIG
        config_data = {
            "ollama_url": settings.get("ollama_url", DEFAULT_CONFIG.get("ollama_url", "http://127.0.0.1:11434")),
            "ollama_model": settings.get("ollama_model", ""),
            "ollama_timeout": settings.get("ollama_timeout", DEFAULT_CONFIG.get("ollama_timeout", 120)),
            "ollama_cloud_url": settings.get("ollama_cloud_url", ""),
            "ollama_cloud_api_key": settings.get("ollama_cloud_api_key", ""),
            "cloud_api_url": settings.get("cloud_api_url", DEFAULT_CONFIG.get("cloud_api_url", "https://openrouter.ai/api/v1")),
            "cloud_api_key": settings.get("cloud_api_key", ""),
            "cloud_model": settings.get("cloud_model", DEFAULT_CONFIG.get("cloud_model", "deepseek/deepseek-chat")),
            "civitai_api_key": settings.get("civitai_api_key", ""),
            "prompts_save_directory": settings.get("prompts_save_directory", ""),
            "prompt_style": settings.get("prompt_style", "Tags (SDXL / Pony)"),
            "syntax_theme": settings.get("syntax_theme", "Modus Neon (Default)"),
            "popout_font_family": settings.get("popout_font_family", "Monospace"),
            "popout_font_size": settings.get("popout_font_size", 14),
        }
        return web.json_response({"success": True, "data": config_data})
    except Exception as e:
        return web.json_response({"success": False, "message": str(e)})

@server.PromptServer.instance.routes.post("/modusflow/save_config")
async def save_config_endpoint(request):
    """API endpoint to update ModusFlow configuration fields."""
    try:
        data = await request.json()
        from .config import settings, save_config

        current_config = settings.copy()
        for key in (
            "ollama_url", "ollama_model", "ollama_timeout", "ollama_cloud_url", "ollama_cloud_api_key",
            "cloud_api_url", "cloud_api_key", "cloud_model", "civitai_api_key", "prompts_save_directory",
            "prompt_style", "syntax_theme", "popout_font_family", "popout_font_size"
        ):
            if key in data:
                val = data[key]
                if key in ("ollama_timeout", "popout_font_size"):
                    try:
                        val = int(val)
                    except (ValueError, TypeError):
                        val = 120 if key == "ollama_timeout" else 14
                elif isinstance(val, str):
                    val = val.strip()
                current_config[key] = val

        if save_config(current_config):
            return web.json_response({"success": True, "message": "Configuration saved successfully."})
        else:
            return web.json_response({"success": False, "message": "Failed to write configuration file."})
    except Exception as e:
        return web.json_response({"success": False, "message": str(e)})

# ── Canvas Live Bridge routes (for IDE / external integration) ───────────────

import time

_active_canvas_node = None
_canvas_nodes_cache = {}

@server.PromptServer.instance.routes.get("/modusflow/canvas/active_node")
async def get_active_canvas_node_endpoint(request):
    """API endpoint to get the currently active / selected ModusFlowTextEditor canvas node."""
    try:
        nodes_list = list(_canvas_nodes_cache.values())
        return web.json_response({
            "success": True,
            "data": _active_canvas_node,
            "nodes": nodes_list
        })
    except Exception as e:
        return web.json_response({"success": False, "message": str(e)})

@server.PromptServer.instance.routes.post("/modusflow/canvas/set_active_node")
async def set_active_canvas_node_endpoint(request):
    """API endpoint for ComfyUI web frontend to report active / selected canvas node(s)."""
    global _active_canvas_node
    try:
        data = await request.json()
        node_id = str(data.get("id", ""))
        if node_id:
            node_info = {
                "id": node_id,
                "title": data.get("title", f"Text Editor #{node_id}"),
                "positive": data.get("positive", ""),
                "negative": data.get("negative", ""),
                "prompt_style": data.get("prompt_style", "Tags (SDXL / Pony)"),
                "is_selected": data.get("is_selected", True),
                "timestamp": time.time()
            }
            _canvas_nodes_cache[node_id] = node_info
            _active_canvas_node = node_info
        return web.json_response({"success": True, "active": _active_canvas_node})
    except Exception as e:
        return web.json_response({"success": False, "message": str(e)})

@server.PromptServer.instance.routes.post("/modusflow/canvas/push_prompt")
async def push_prompt_to_canvas_endpoint(request):
    """API endpoint to push prompt text from IDE to active canvas node in ComfyUI."""
    try:
        data = await request.json()
        node_id = data.get("node_id")
        positive = data.get("positive", "")
        negative = data.get("negative")
        prompt_style = data.get("prompt_style")

        payload = {
            "node_id": str(node_id) if node_id else None,
            "positive": positive,
            "negative": negative,
            "prompt_style": prompt_style
        }

        # Broadcast event to ComfyUI web client via WebSocket
        server.PromptServer.instance.send_sync("modusflow_canvas_push", payload)

        # Update cache if node is known
        if _active_canvas_node:
            _active_canvas_node["positive"] = positive
            if negative is not None:
                _active_canvas_node["negative"] = negative
            if prompt_style:
                _active_canvas_node["prompt_style"] = prompt_style

        return web.json_response({"success": True, "message": "Prompt pushed to canvas node via WebSocket"})
    except Exception as e:
        return web.json_response({"success": False, "message": str(e)})

import shutil

_auto_migration_done = False

def _auto_migrate_saved_directories():
    """
    Automatically creates subdirectories:
      saved_prompts/prompts/
      saved_prompts/songs/
      saved_prompts/songs/tags/
      saved_prompts/songs/lyrics/
    And migrates any existing files from root saved_prompts/ and legacy saved_songs/
    into their dedicated subdirectories.
    """
    global _auto_migration_done
    if _auto_migration_done:
        return
    _auto_migration_done = True

    try:
        from .config import settings, BASE_DIR
        prompts_dir = settings.get('prompts_save_directory', '').strip()
        if not prompts_dir:
            prompts_dir = os.path.join(BASE_DIR, 'saved_prompts')

        prompts_subdir = os.path.join(prompts_dir, 'prompts')
        songs_subdir = os.path.join(prompts_dir, 'songs')
        tags_subdir = os.path.join(songs_subdir, 'tags')
        lyrics_subdir = os.path.join(songs_subdir, 'lyrics')

        # Ensure all subdirectories exist
        os.makedirs(prompts_subdir, exist_ok=True)
        os.makedirs(songs_subdir, exist_ok=True)
        os.makedirs(tags_subdir, exist_ok=True)
        os.makedirs(lyrics_subdir, exist_ok=True)

        # 1. Migrate loose files directly in saved_prompts/
        if os.path.isdir(prompts_dir):
            for item in os.listdir(prompts_dir):
                item_path = os.path.join(prompts_dir, item)
                if not os.path.isfile(item_path):
                    continue

                if item.endswith('.json'):
                    is_song = False
                    try:
                        with open(item_path, 'r', encoding='utf-8') as f:
                            data = json.load(f)
                        if data.get('type') in ('song', 'ace_song') or 'lyrics' in data:
                            is_song = True
                    except Exception:
                        pass

                    dest_dir = songs_subdir if is_song else prompts_subdir
                    dest_file = os.path.join(dest_dir, item)
                    if not os.path.exists(dest_file):
                        shutil.move(item_path, dest_file)
                        print(f"[ModusFlow] Auto-migrated {item} -> {os.path.basename(dest_dir)}/")

        # 2. Migrate legacy saved_songs/ if present
        legacy_songs_dir = os.path.join(BASE_DIR, 'saved_songs')
        if os.path.isdir(legacy_songs_dir):
            # Songs JSONs
            for item in os.listdir(legacy_songs_dir):
                item_path = os.path.join(legacy_songs_dir, item)
                if os.path.isfile(item_path) and item.endswith('.json'):
                    dest_file = os.path.join(songs_subdir, item)
                    if not os.path.exists(dest_file):
                        shutil.move(item_path, dest_file)
                        print(f"[ModusFlow] Auto-migrated legacy song {item} -> songs/")

            # Legacy tags
            legacy_tags = os.path.join(legacy_songs_dir, 'tags')
            if os.path.isdir(legacy_tags):
                for item in os.listdir(legacy_tags):
                    item_path = os.path.join(legacy_tags, item)
                    if os.path.isfile(item_path) and item.endswith('.txt'):
                        dest_file = os.path.join(tags_subdir, item)
                        if not os.path.exists(dest_file):
                            shutil.move(item_path, dest_file)
                            print(f"[ModusFlow] Auto-migrated legacy tag {item} -> songs/tags/")

            # Legacy lyrics
            legacy_lyrics = os.path.join(legacy_songs_dir, 'lyrics')
            if os.path.isdir(legacy_lyrics):
                for item in os.listdir(legacy_lyrics):
                    item_path = os.path.join(legacy_lyrics, item)
                    if os.path.isfile(item_path) and item.endswith('.txt'):
                        dest_file = os.path.join(lyrics_subdir, item)
                        if not os.path.exists(dest_file):
                            shutil.move(item_path, dest_file)
                            print(f"[ModusFlow] Auto-migrated legacy lyric {item} -> songs/lyrics/")

    except Exception as e:
        print(f"[ModusFlow] Error during auto-migration: {e}")

def _get_base_prompts_dir():
    """Return the root prompts save directory, running auto-migration first."""
    _auto_migrate_saved_directories()
    from .config import settings, BASE_DIR
    prompts_dir = settings.get('prompts_save_directory', '').strip()
    if not prompts_dir:
        prompts_dir = os.path.join(BASE_DIR, 'saved_prompts')
    os.makedirs(prompts_dir, exist_ok=True)
    return prompts_dir

def _get_prompts_dir():
    """Return the prompts subdirectory under saved_prompts (e.g. saved_prompts/prompts)."""
    prompts_subdir = os.path.join(_get_base_prompts_dir(), 'prompts')
    os.makedirs(prompts_subdir, exist_ok=True)
    return prompts_subdir

def _get_songs_dir():
    """Return the songs subdirectory under saved_prompts (e.g. saved_prompts/songs)."""
    from .config import settings, BASE_DIR
    songs_dir = settings.get("songs_save_directory", "").strip()
    if not songs_dir:
        songs_dir = os.path.join(_get_base_prompts_dir(), "songs")
    os.makedirs(songs_dir, exist_ok=True)
    return songs_dir

@server.PromptServer.instance.routes.post("/modusflow/save_prompt")
async def save_prompt_endpoint(request):
    """API endpoint to save a text prompt to a JSON file in saved_prompts/prompts/."""
    try:
        data = await request.json()
        filename = data.get("filename", "").strip()
        category = data.get("category", "").strip()
        positive = data.get("positive", "")
        negative = data.get("negative", "")

        if not filename:
            return web.json_response({"success": False, "message": "Filename cannot be empty."})

        # Sanitize filename to prevent directory traversal
        filename = os.path.basename(filename)
        # Strip legacy .txt extension and ensure .json
        if filename.endswith('.txt'):
            filename = filename[:-4]
        if not filename.endswith('.json'):
            filename += '.json'

        prompts_dir = _get_prompts_dir()
        file_path = os.path.join(prompts_dir, filename)
        prompt_data = {"type": data.get("type", "prompt") or "prompt", "category": category, "positive": positive, "negative": negative}
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(prompt_data, f, ensure_ascii=False, indent=2)

        print(f"[ModusFlow TextEditor] Saved prompt to: {file_path}")
        return web.json_response({"success": True, "message": f"Prompt saved as {filename}"})
    except Exception as e:
        msg = f"Error saving prompt: {e}"
        print(f"[ModusFlow TextEditor] {msg}")
        return web.json_response({"success": False, "message": msg})

@server.PromptServer.instance.routes.post("/modusflow/load_prompt")
async def load_prompt_endpoint(request):
    """API endpoint to load a text prompt from JSON (checks prompts/, root saved_prompts/, and songs/)."""
    try:
        data = await request.json()
        filename = data.get("filename", "").strip()

        if not filename:
            return web.json_response({"success": False, "message": "Filename cannot be empty."})

        filename = os.path.basename(filename)

        # Check in prompts/ subdirectory first, then root saved_prompts/, then songs/
        candidate_paths = [
            os.path.join(_get_prompts_dir(), filename),
            os.path.join(_get_base_prompts_dir(), filename),
            os.path.join(_get_songs_dir(), filename)
        ]
        file_path = next((p for p in candidate_paths if os.path.exists(p)), None)

        if not file_path:
            return web.json_response({"success": False, "message": f"File '{filename}' not found."})

        with open(file_path, 'r', encoding='utf-8') as f:
            prompt_data = json.load(f)

        # Seamlessly support all text node JSON formats
        positive_val = prompt_data.get("positive", "")
        if not positive_val:
            if "lyrics" in prompt_data and "tags" in prompt_data:
                positive_val = f"{prompt_data.get('tags', '')}\n\n{prompt_data.get('lyrics', '')}".strip()
            elif "lyrics" in prompt_data:
                positive_val = prompt_data.get("lyrics", "")
            elif "text" in prompt_data:
                positive_val = prompt_data.get("text", "")

        negative_val = prompt_data.get("negative", "")
        if not negative_val and "negative_style" in prompt_data:
            negative_val = prompt_data.get("negative_style", "")

        print(f"[ModusFlow TextEditor] Loaded prompt from: {file_path}")
        return web.json_response({
            "success": True,
            "data": {
                "category": prompt_data.get("category", ""),
                "positive": positive_val,
                "negative": negative_val,
                "type": prompt_data.get("type", "prompt"),
                **prompt_data
            }
        })
    except Exception as e:
        msg = f"Error loading prompt: {e}"
        print(f"[ModusFlow TextEditor] {msg}")
        return web.json_response({"success": False, "message": msg})

@server.PromptServer.instance.routes.get("/modusflow/list_prompts")
async def list_prompts_endpoint(request):
    """API endpoint to list all saved prompts across prompts/, root saved_prompts/, and songs/."""
    try:
        seen = set()
        prompts = []

        # Check directories in order of priority: prompts/ subdir, root saved_prompts/, songs/
        scan_dirs = [_get_prompts_dir(), _get_base_prompts_dir(), _get_songs_dir()]
        for d in scan_dirs:
            if os.path.isdir(d):
                for filename in sorted(f for f in os.listdir(d) if f.endswith('.json')):
                    if filename in seen:
                        continue
                    seen.add(filename)
                    category = ""
                    file_type = "prompt"
                    try:
                        file_path = os.path.join(d, filename)
                        with open(file_path, 'r', encoding='utf-8') as f:
                            data = json.load(f)
                        category = data.get('category', '') or ''
                        file_type = data.get('type', 'prompt') or 'prompt'
                    except Exception:
                        pass
                    prompts.append({"filename": filename, "category": category, "type": file_type})

        return web.json_response({"success": True, "data": prompts})
    except Exception as e:
        msg = f"Error listing prompts: {e}"
        print(f"[ModusFlow TextEditor] {msg}")
        return web.json_response({"success": False, "message": msg})

# ── Wildcard / List Curator routes ──────────────────────────────────────────

def _get_wildcards_dir():
    """Return the wildcards directory under saved_prompts (strictly isolated)."""
    wc_dir = os.path.join(_get_base_prompts_dir(), 'wildcards')
    os.makedirs(wc_dir, exist_ok=True)
    return wc_dir

@server.PromptServer.instance.routes.get("/modusflow/wildcards/list")
async def list_wildcards_endpoint(request):
    """API endpoint to list all wildcard .txt files in saved_prompts/wildcards/."""
    try:
        wc_dir = _get_wildcards_dir()
        files = []
        if os.path.isdir(wc_dir):
            for f in sorted(os.listdir(wc_dir)):
                if f.lower().endswith('.txt') and os.path.isfile(os.path.join(wc_dir, f)):
                    files.append(os.path.splitext(f)[0])
        return web.json_response({"success": True, "data": files})
    except Exception as e:
        return web.json_response({"success": False, "message": str(e)})

@server.PromptServer.instance.routes.post("/modusflow/wildcards/load")
async def load_wildcard_endpoint(request):
    """API endpoint to load the text lines of a wildcard file."""
    try:
        data = await request.json()
        raw_name = data.get("filename", "").strip()
        if raw_name.startswith("__") and raw_name.endswith("__") and len(raw_name) > 4:
            raw_name = raw_name[2:-2].strip()
        name = os.path.basename(raw_name)
        if not name:
            return web.json_response({"success": False, "message": "Filename cannot be empty."})
        if not name.endswith(".txt"):
            name += ".txt"
        file_path = os.path.join(_get_wildcards_dir(), name)
        if not os.path.isfile(file_path):
            return web.json_response({"success": False, "message": f"File '{name}' not found."})
        with open(file_path, "r", encoding="utf-8") as f:
            content = f.read()
        return web.json_response({"success": True, "data": content, "filename": os.path.splitext(name)[0]})
    except Exception as e:
        return web.json_response({"success": False, "message": str(e)})

@server.PromptServer.instance.routes.post("/modusflow/wildcards/save")
async def save_wildcard_endpoint(request):
    """API endpoint to save or update a wildcard .txt file in saved_prompts/wildcards/."""
    try:
        data = await request.json()
        raw_name = data.get("filename", "").strip()
        if raw_name.startswith("__") and raw_name.endswith("__") and len(raw_name) > 4:
            raw_name = raw_name[2:-2].strip()
        name = os.path.basename(raw_name)
        content = data.get("content", "")
        if not name:
            return web.json_response({"success": False, "message": "Filename cannot be empty."})
        if not name.endswith(".txt"):
            name += ".txt"
        file_path = os.path.join(_get_wildcards_dir(), name)
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(content)
        print(f"[ModusFlow ListCurator] Saved wildcard file: {file_path}")
        return web.json_response({"success": True, "message": f"Saved {name}", "filename": os.path.splitext(name)[0]})
    except Exception as e:
        return web.json_response({"success": False, "message": str(e)})

@server.PromptServer.instance.routes.post("/modusflow/wildcards/delete")
async def delete_wildcard_endpoint(request):
    """API endpoint to delete a wildcard .txt file from saved_prompts/wildcards/."""
    try:
        data = await request.json()
        raw_name = data.get("filename", "").strip()
        if raw_name.startswith("__") and raw_name.endswith("__") and len(raw_name) > 4:
            raw_name = raw_name[2:-2].strip()
        name = os.path.basename(raw_name)
        if not name:
            return web.json_response({"success": False, "message": "Filename cannot be empty."})
        if not name.endswith(".txt"):
            name += ".txt"
        file_path = os.path.join(_get_wildcards_dir(), name)
        if os.path.isfile(file_path):
            os.remove(file_path)
            print(f"[ModusFlow ListCurator] Deleted wildcard file: {file_path}")
            return web.json_response({"success": True, "message": f"Deleted {name}"})
        return web.json_response({"success": False, "message": f"File '{name}' not found."})
    except Exception as e:
        return web.json_response({"success": False, "message": str(e)})

# ── Syntax Highlighting Themes routes ───────────────────────────────────────

def _get_syntax_themes_path():
    """Return path to syntax_themes.json (checking saved_prompts, then root, auto-creating from example if missing)."""
    from .config import BASE_DIR
    custom_path = os.path.join(_get_base_prompts_dir(), 'syntax_themes.json')
    if os.path.isfile(custom_path):
        return custom_path
    root_path = os.path.join(BASE_DIR, 'syntax_themes.json')
    if os.path.isfile(root_path):
        return root_path

    # Auto-create syntax_themes.json from syntax_themes.json.example
    example_path = os.path.join(BASE_DIR, 'syntax_themes.json.example')
    if os.path.isfile(example_path):
        try:
            shutil.copyfile(example_path, root_path)
            return root_path
        except Exception:
            return example_path
    return root_path

@server.PromptServer.instance.routes.get("/modusflow/syntax_themes")
async def get_syntax_themes_endpoint(request):
    """API endpoint to get syntax highlighting color themes."""
    try:
        path = _get_syntax_themes_path()
        if os.path.isfile(path):
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
            return web.json_response({"success": True, "data": data})
        return web.json_response({"success": False, "message": "Theme file not found"})
    except Exception as e:
        return web.json_response({"success": False, "message": str(e)})

@server.PromptServer.instance.routes.post("/modusflow/syntax_themes/save")
async def save_syntax_themes_endpoint(request):
    """API endpoint to save or update syntax highlighting themes."""
    try:
        data = await request.json()
        path = _get_syntax_themes_path()
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)
        return web.json_response({"success": True, "message": "Themes updated"})
    except Exception as e:
        return web.json_response({"success": False, "message": str(e)})

# ── Song Writer routes ─────────────────────────────────────────────────────────

@server.PromptServer.instance.routes.get("/modusflow/song/list")
async def song_writer_list(request):
    """API endpoint to list all saved songs across songs/, root saved_prompts/, and legacy saved_songs/."""
    try:
        from .config import BASE_DIR
        legacy_dir = os.path.join(BASE_DIR, "saved_songs")
        scan_dirs = [_get_songs_dir(), _get_base_prompts_dir(), legacy_dir]

        seen = set()
        songs = []
        for d in scan_dirs:
            if os.path.isdir(d):
                for filename in sorted(f for f in os.listdir(d) if f.endswith(".json")):
                    if filename in seen:
                        continue
                    category = "Song"
                    title = ""
                    try:
                        file_path = os.path.join(d, filename)
                        with open(file_path, "r", encoding="utf-8") as f:
                            data = json.load(f)
                        category = data.get("category", "") or "Song"
                        title = data.get("title", "")
                        is_song = data.get("type") in ("song", "ace_song") or "lyrics" in data
                        if not is_song:
                            continue
                    except Exception:
                        pass
                    seen.add(filename)
                    songs.append({"filename": filename, "category": category, "title": title})
        return web.json_response({"success": True, "data": songs})
    except Exception as e:
        msg = f"Error listing songs: {e}"
        print(f"[ModusFlow SongWriter] {msg}")
        return web.json_response({"success": False, "message": msg})

@server.PromptServer.instance.routes.post("/modusflow/song/save")
async def song_writer_save(request):
    """API endpoint to save a song JSON file into saved_prompts/songs/."""
    try:
        data = await request.json()
        filename = data.get("filename", "").strip()
        if not filename:
            return web.json_response({"success": False, "message": "Filename cannot be empty."})

        filename = os.path.basename(filename)
        if not filename.endswith(".json"):
            filename += ".json"

        songs_dir = _get_songs_dir()
        file_path = os.path.join(songs_dir, filename)

        song_payload = {
            "type": "song",
            "category": data.get("category", "Song") or "Song",
            "title": data.get("title", ""),
            "genre": data.get("genre", ""),
            "vocal_style": data.get("vocal_style", ""),
            "mood": data.get("mood", ""),
            "template": data.get("template", ""),
            "lyrics": data.get("lyrics", ""),
            "additional_style": data.get("additional_style", ""),
            "negative_style": data.get("negative_style", "")
        }

        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(song_payload, f, ensure_ascii=False, indent=2)

        print(f"[ModusFlow SongWriter] Saved song to: {file_path}")
        return web.json_response({"success": True, "message": f"Song saved as {filename}"})
    except Exception as e:
        msg = f"Error saving song: {e}"
        print(f"[ModusFlow SongWriter] {msg}")
        return web.json_response({"success": False, "message": msg})

@server.PromptServer.instance.routes.post("/modusflow/song/load")
async def song_writer_load(request):
    """API endpoint to load a song JSON file from songs/, root saved_prompts/, or legacy saved_songs/."""
    try:
        data = await request.json()
        filename = data.get("filename", "").strip()
        if not filename:
            return web.json_response({"success": False, "message": "Filename cannot be empty."})

        filename = os.path.basename(filename)
        from .config import BASE_DIR
        candidate_paths = [
            os.path.join(_get_songs_dir(), filename),
            os.path.join(_get_base_prompts_dir(), filename),
            os.path.join(BASE_DIR, "saved_songs", filename)
        ]
        file_path = next((p for p in candidate_paths if os.path.exists(p)), None)

        if not file_path:
            return web.json_response({"success": False, "message": f"Song file '{filename}' not found."})

        with open(file_path, "r", encoding="utf-8") as f:
            song_data = json.load(f)

        return web.json_response({"success": True, "data": song_data})
    except Exception as e:
        msg = f"Error loading song: {e}"
        print(f"[ModusFlow SongWriter] {msg}")
        return web.json_response({"success": False, "message": msg})

@server.PromptServer.instance.routes.get("/modusflow/ace_audio/list")
async def ace_audio_list(request):
    """API endpoint to list all saved song files."""
    try:
        from .config import BASE_DIR
        scan_dirs = [_get_songs_dir(), _get_base_prompts_dir(), os.path.join(BASE_DIR, "saved_songs")]
        seen = set()
        files = []
        for d in scan_dirs:
            if os.path.isdir(d):
                for f in sorted(os.listdir(d)):
                    if f.endswith(".json") and f not in seen:
                        seen.add(f)
                        files.append(f)
        return web.json_response({"success": True, "data": files})
    except Exception as e:
        msg = f"Error listing songs: {e}"
        print(f"[ModusFlow AceStepAudio] {msg}")
        return web.json_response({"success": False, "message": msg})

@server.PromptServer.instance.routes.post("/modusflow/ace_audio/save")
async def ace_audio_save(request):
    """API endpoint to save tags and lyrics as a JSON song file in saved_prompts/songs/."""
    try:
        data = await request.json()
        filename = data.get("filename", "").strip()
        title = data.get("title", "")
        tags = data.get("tags", "")
        lyrics = data.get("lyrics", "")
        category = data.get("category", "Song") or "Song"

        if not filename:
            return web.json_response({"success": False, "message": "Filename cannot be empty."})

        filename = os.path.basename(filename)
        if not filename.endswith(".json"):
            filename += ".json"

        songs_dir = _get_songs_dir()
        file_path = os.path.join(songs_dir, filename)

        with open(file_path, "w", encoding="utf-8") as f:
            json.dump({"type": "ace_song", "category": category, "title": title, "tags": tags, "lyrics": lyrics}, f, ensure_ascii=False, indent=2)

        print(f"[ModusFlow AceStepAudio] Saved song to: {file_path}")
        return web.json_response({"success": True, "message": f"Song saved as {filename}"})
    except Exception as e:
        msg = f"Error saving song: {e}"
        print(f"[ModusFlow AceStepAudio] {msg}")
        return web.json_response({"success": False, "message": msg})

@server.PromptServer.instance.routes.post("/modusflow/ace_audio/load")
async def ace_audio_load(request):
    """API endpoint to load tags and lyrics from a JSON song file."""
    try:
        data = await request.json()
        filename = data.get("filename", "").strip()

        if not filename:
            return web.json_response({"success": False, "message": "Filename cannot be empty."})

        filename = os.path.basename(filename)
        from .config import BASE_DIR
        candidate_paths = [
            os.path.join(_get_songs_dir(), filename),
            os.path.join(_get_base_prompts_dir(), filename),
            os.path.join(BASE_DIR, "saved_songs", filename)
        ]
        file_path = next((p for p in candidate_paths if os.path.exists(p)), None)

        if not file_path:
            return web.json_response({"success": False, "message": f"Song file '{filename}' not found."})

        with open(file_path, "r", encoding="utf-8") as f:
            song_data = json.load(f)

        return web.json_response({"success": True, "data": song_data})
    except Exception as e:
        msg = f"Error loading song: {e}"
        print(f"[ModusFlow AceStepAudio] {msg}")
        return web.json_response({"success": False, "message": msg})

# ── Individual tags routes ────────────────────────────────────────────────────

@server.PromptServer.instance.routes.get("/modusflow/ace_audio/list_tags")
async def ace_audio_list_tags(request):
    """API endpoint to list all saved tags files."""
    try:
        tags_dir = os.path.join(_get_songs_dir(), "tags")
        os.makedirs(tags_dir, exist_ok=True)
        files = sorted(f for f in os.listdir(tags_dir) if f.endswith(".txt"))
        return web.json_response({"success": True, "data": files})
    except Exception as e:
        msg = f"Error listing tags: {e}"
        print(f"[ModusFlow AceStepAudio] {msg}")
        return web.json_response({"success": False, "message": msg})

@server.PromptServer.instance.routes.post("/modusflow/ace_audio/save_tags")
async def ace_audio_save_tags(request):
    """API endpoint to save tags as a .txt file."""
    try:
        data = await request.json()
        filename = data.get("filename", "").strip()
        tags = data.get("tags", "")
        if not filename:
            return web.json_response({"success": False, "message": "Filename cannot be empty."})
        filename = os.path.basename(filename)
        if not filename.endswith(".txt"):
            filename += ".txt"
        tags_dir = os.path.join(_get_songs_dir(), "tags")
        os.makedirs(tags_dir, exist_ok=True)
        with open(os.path.join(tags_dir, filename), "w", encoding="utf-8") as f:
            f.write(tags)
        print(f"[ModusFlow AceStepAudio] Saved tags: {filename}")
        return web.json_response({"success": True, "message": f"Tags saved as {filename}"})
    except Exception as e:
        msg = f"Error saving tags: {e}"
        print(f"[ModusFlow AceStepAudio] {msg}")
        return web.json_response({"success": False, "message": msg})

@server.PromptServer.instance.routes.post("/modusflow/ace_audio/load_tags")
async def ace_audio_load_tags(request):
    """API endpoint to load tags from a .txt file."""
    try:
        data = await request.json()
        filename = os.path.basename(data.get("filename", "").strip())
        if not filename:
            return web.json_response({"success": False, "message": "Filename cannot be empty."})
        tags_dir = os.path.join(_get_songs_dir(), "tags")
        file_path = os.path.join(tags_dir, filename)
        if not os.path.exists(file_path):
            return web.json_response({"success": False, "message": f"Tags file '{filename}' not found."})
        with open(file_path, "r", encoding="utf-8") as f:
            content = f.read()
        return web.json_response({"success": True, "data": content})
    except Exception as e:
        msg = f"Error loading tags: {e}"
        print(f"[ModusFlow AceStepAudio] {msg}")
        return web.json_response({"success": False, "message": msg})

# ── Individual lyrics routes ──────────────────────────────────────────────────

@server.PromptServer.instance.routes.get("/modusflow/ace_audio/list_lyrics")
async def ace_audio_list_lyrics(request):
    """API endpoint to list all saved lyrics files."""
    try:
        lyrics_dir = os.path.join(_get_songs_dir(), "lyrics")
        os.makedirs(lyrics_dir, exist_ok=True)
        files = sorted(f for f in os.listdir(lyrics_dir) if f.endswith(".txt"))
        return web.json_response({"success": True, "data": files})
    except Exception as e:
        msg = f"Error listing lyrics: {e}"
        print(f"[ModusFlow AceStepAudio] {msg}")
        return web.json_response({"success": False, "message": msg})

@server.PromptServer.instance.routes.post("/modusflow/ace_audio/save_lyrics")
async def ace_audio_save_lyrics(request):
    """API endpoint to save lyrics as a .txt file."""
    try:
        data = await request.json()
        filename = data.get("filename", "").strip()
        lyrics = data.get("lyrics", "")
        if not filename:
            return web.json_response({"success": False, "message": "Filename cannot be empty."})
        filename = os.path.basename(filename)
        if not filename.endswith(".txt"):
            filename += ".txt"
        lyrics_dir = os.path.join(_get_songs_dir(), "lyrics")
        os.makedirs(lyrics_dir, exist_ok=True)
        with open(os.path.join(lyrics_dir, filename), "w", encoding="utf-8") as f:
            f.write(lyrics)
        print(f"[ModusFlow AceStepAudio] Saved lyrics: {filename}")
        return web.json_response({"success": True, "message": f"Lyrics saved as {filename}"})
    except Exception as e:
        msg = f"Error saving lyrics: {e}"
        print(f"[ModusFlow AceStepAudio] {msg}")
        return web.json_response({"success": False, "message": msg})

@server.PromptServer.instance.routes.post("/modusflow/ace_audio/load_lyrics")
async def ace_audio_load_lyrics(request):
    """API endpoint to load lyrics from a .txt file."""
    try:
        data = await request.json()
        filename = os.path.basename(data.get("filename", "").strip())
        if not filename:
            return web.json_response({"success": False, "message": "Filename cannot be empty."})
        lyrics_dir = os.path.join(_get_songs_dir(), "lyrics")
        file_path = os.path.join(lyrics_dir, filename)
        if not os.path.exists(file_path):
            return web.json_response({"success": False, "message": f"Lyrics file '{filename}' not found."})
        with open(file_path, "r", encoding="utf-8") as f:
            content = f.read()
        return web.json_response({"success": True, "data": content})
    except Exception as e:
        msg = f"Error loading lyrics: {e}"
        print(f"[ModusFlow AceStepAudio] {msg}")
        return web.json_response({"success": False, "message": msg})

def calculate_sha256(file_path, chunk_size=1024*1024):
    """Calculates the SHA256 hash of a file."""
    sha256 = hashlib.sha256()
    with open(file_path, "rb") as f:
        while True:
            data = f.read(chunk_size)
            if not data:
                break
            sha256.update(data)
    return sha256.hexdigest().upper()

def _get_model_type(name: str, definitions: list) -> str:
    """A simple heuristic to determine the general type of a model file or metadata string based on definitions."""
    if not name or not isinstance(name, str):
        return 'unknown'
    
    lower_name = name.lower()
    
    for definition in definitions:
        model_type = definition.get("type")
        if not model_type:
            continue
        for keyword in definition.get("keywords", []):
            if keyword.lower() in lower_name:
                return model_type
    
    return re.split(r'[\s._-]', lower_name)[0] or 'unknown'

@server.PromptServer.instance.routes.get("/modusflow/get_lora_civitai_info")
async def get_lora_civitai_info(request):
    """API endpoint to get LoRA info from Civitai by file hash."""
    lora_name = request.query.get("name")
    api_key_from_request = request.query.get("api_key")
    if not lora_name:
        return web.json_response({"success": False, "message": "LoRA name not provided"})

    try:
        # Use ComfyUI's built-in file resolver which is more reliable.
        # Use the same logic as the node itself to find the LoRA file path.
        lora_paths_list = folder_paths.get_filename_list("loras")
        lora_file_relative = ModusFlowLoraLoader.find_lora_path(lora_name, lora_paths_list)

        if not lora_file_relative:
            msg = f"LoRA file not found for: {lora_name}"
            print(f"[ModusFlow LoRA Loader] Civitai Info: {msg}")
            return web.json_response({"success": False, "message": msg})

        lora_path = folder_paths.get_full_path("loras", lora_file_relative)
        if not lora_path or not os.path.exists(lora_path):
            msg = f"LoRA file path could not be resolved for: {lora_file_relative}"
            print(f"[ModusFlow LoRA Loader] Civitai Info: {msg}")
            return web.json_response({"success": False, "message": msg})

        file_hash = calculate_sha256(lora_path)
        civitai_api_url = f"https://civitai.com/api/v1/model-versions/by-hash/{file_hash}"

        headers = {}
        # Prioritize API key from the request, fall back to config file.
        api_key = api_key_from_request or settings.get("civitai_api_key")
        if api_key:
            headers["Authorization"] = f"Bearer {api_key}"

        response = requests.get(civitai_api_url, timeout=15, headers=headers)

        if response.status_code == 404:
            return web.json_response({"success": False, "message": "Model not found on Civitai with this hash."})

        response.raise_for_status()
        data = response.json()

        if not isinstance(data, dict):
            print(f"[ModusFlow LoRA Loader] Civitai API did not return a JSON object for hash: {file_hash}")
            return web.json_response({"success": False, "message": "Invalid response from Civitai API (not a JSON object)."})

        model_data = data.get("model", {})
        # Ensure model_data is a dictionary, default to empty if it's None or something else
        if not isinstance(model_data, dict):
            print(f"[ModusFlow LoRA Loader] Civitai API returned a non-dict 'model' field for hash: {file_hash}. Response: {data}")
            model_data = {} # Default to empty dict to prevent errors
        
        # More robustly check for model_id, preferring the top-level one.
        # This avoids issues with falsy values like 0.
        model_id = data.get("modelId")
        if model_id is None:
            model_id = model_data.get("id")

        if model_id is None:
            print(f"[ModusFlow LoRA Loader] Civitai API returned a response without a model ID for hash: {file_hash}")
            return web.json_response({"success": False, "message": "Model found, but the Civitai API response was missing a model ID. Check console for details."})

        info = {
            "modelId": model_id,
            "modelName": model_data.get("name"),
            "creator": model_data.get("creator", {}).get("username"),
            "trainedWords": data.get("trainedWords", []),
            "description": model_data.get("description"),
            "images": [img.get("url") for img in data.get("images", []) if img.get("url")]
        }
        return web.json_response({"success": True, "data": info})
    except requests.exceptions.RequestException as e:
        return web.json_response({"success": False, "message": f"Failed to connect to Civitai: {e}"})
    except Exception as e:
        return web.json_response({"success": False, "message": f"An unexpected error occurred: {e}"})

@server.PromptServer.instance.routes.get("/modusflow/get_lora_metadata")
async def get_lora_metadata(request):
    """API endpoint to get metadata and a preview image from a specific LoRA file."""
    lora_name = request.query.get("name")
    base_model_name = request.query.get("base_model_name")
    if not lora_name:
        return web.json_response({"success": False, "message": "LoRA name not provided"})

    try:
        # Use the same logic as the node itself to find the LoRA file path.
        lora_paths_list = folder_paths.get_filename_list("loras")
        lora_file_relative = ModusFlowLoraLoader.find_lora_path(lora_name, lora_paths_list)

        if not lora_file_relative:
            msg = f"LoRA file not found for: {lora_name}"
            print(f"[ModusFlow LoRA Loader] Local Metadata: {msg}")
            return web.json_response({"success": False, "message": msg})

        lora_path = folder_paths.get_full_path("loras", lora_file_relative)
        if not lora_path or not os.path.exists(lora_path):
            msg = f"LoRA file path could not be resolved for: {lora_file_relative}"
            print(f"[ModusFlow LoRA Loader] Local Metadata: {msg}")
            return web.json_response({"success": False, "message": msg})

        # --- Extract Safetensors Metadata ---
        metadata = {}
        if lora_path.lower().endswith(".safetensors"):
            with safetensors.safe_open(lora_path, framework="pt", device="cpu") as f:
                metadata = f.metadata() or {}
        else:
            print(f"[ModusFlow LoRA Loader] Skipped metadata check for non-safetensors file: {lora_name}")

        parsed_metadata = {}
        for key, value in metadata.items():
            try:
                parsed_metadata[key] = json.loads(value)
            except (json.JSONDecodeError, TypeError):
                parsed_metadata[key] = value

        if not parsed_metadata:
            print(f"[ModusFlow LoRA Loader] No metadata found in LoRA file: {lora_name}")

        # --- Find Preview Image ---
        preview_image_url = None

        # Priority 1: Check for embedded preview image in metadata (case-insensitive)
        if metadata:
            found_key = None
            # Search for standard preview keys, case-insensitively
            for key in metadata.keys():
                if key.lower() in ["ss_preview_image", "ss_preview"]:
                    found_key = key
                    break
            
            if found_key:
                base64_image = metadata[found_key]
                # Ensure we have a non-empty string before processing
                if base64_image and isinstance(base64_image, str):
                    if not base64_image.startswith('data:image'):
                        preview_image_url = f"data:image/png;base64,{base64_image}"
                    else:
                        preview_image_url = base64_image

        # Priority 2: Fallback to finding an external file if no embedded one was found
        if not preview_image_url:
            lora_file_relative_no_ext, _ = os.path.splitext(lora_file_relative)
            for ext in ['.png', '.jpg', '.jpeg', '.webp']:
                potential_preview_relative = lora_file_relative_no_ext + ext
                full_preview_path = folder_paths.get_full_path("loras", potential_preview_relative)
                if full_preview_path and os.path.exists(full_preview_path):
                    # Correctly split the path into subfolder and filename for the /view endpoint
                    subfolder, filename = os.path.split(potential_preview_relative)
                    preview_image_url = f"/view?filename={quote(filename)}&type=loras&subfolder={quote(subfolder)}"
                    break

        # --- Perform Validation ---
        validation = {"status": "unknown", "message": "Validation not performed."}
        if base_model_name and base_model_name != "None":
            lora_base_model_str = parsed_metadata.get("ss_base_model_version") or parsed_metadata.get("modelspec.architecture") or ""
            if not lora_base_model_str:
                validation = {"status": "unknown", "message": "No base model specified in LoRA metadata."}
            else:
                definitions = settings.get("base_model_definitions", [])
                lora_type = _get_model_type(lora_base_model_str, definitions)
                base_model_type = _get_model_type(base_model_name, definitions)

                if lora_type != 'unknown' and base_model_type != 'unknown' and lora_type != base_model_type:
                    validation = {
                        "status": "incompatible",
                        "message": f"Warning: LoRA base model ('{lora_type}') may not match selected base model ('{base_model_type}')."
                    }
                else:
                    validation = {
                        "status": "compatible",
                        "message": f"LoRA base model ('{lora_type}') appears compatible with selected base model ('{base_model_type}')."
                    }

        # --- Combine and Return ---
        final_data = {
            "local_metadata": parsed_metadata,
            "preview_image_url": preview_image_url,
            "validation": validation
        }
        return web.json_response({"success": True, "data": final_data})
    except Exception as e:
        print(f"[ModusFlow LoRA Loader] Error reading metadata for '{lora_name}': {e}")
        return web.json_response({"success": False, "message": f"Could not read metadata. File may be corrupted or not a valid safetensors file. Error: {e}"})

NODE_CLASS_MAPPINGS = {
    "OllamaPromptRefiner": OllamaPromptRefinerNode,
    "ImageForPrompting": ModusFlowImageForPromptingNode,
    "ModusFlowBatchKSampler": ModusFlowBatchKSampler,
    "ModusFlowLoraLoader": ModusFlowLoraLoader,
    "ModusFlowUpscaler": ModusFlowUpscaler,
    "ModusFlowKSampler": ModusFlowKSampler,
    "ModusFlowModelLoader": ModusFlowModelLoader,
    "ModusFlowMultiCLIPTextEncode": ModusFlowMultiCLIPTextEncode,
    "ModusFlowShowText": ModusFlowShowText,
    "ModusFlowTextEditor": ModusFlowTextEditor,
    "ModusFlowImageGallery": ModusFlowImageGallery,
    "ModusFlowLatentPreset": ModusFlowLatentPreset,
    "ModusFlowSaveAudio": ModusFlowSaveAudio,
    "ModusFlowAceStepAudio": ModusFlowAceStepAudio,
    "OllamaTextRefiner": OllamaTextRefinerNode,
    "ModusFlowSaveImage": ModusFlowSaveImage,
    "ModusFlowDetailerSlot": ModusFlowDetailerSlot,
    "ModusFlowAllInOneDetailer": ModusFlowAllInOneDetailer,
    "ModusFlowConditioningConcat": ModusFlowConditioningConcat,
    "ModusFlowRestormer": ModusFlowRestormer,
    "ModusDynamicGuidance": ModusDynamicGuidance,
    "ModusDeWaxTextureRestore": ModusDeWaxTextureRestore,
    "ModusFlowVideoLatent": ModusFlowVideoLatent,
    "ModusFlowSaveVideo": ModusFlowSaveVideo,
    "ModusFlowSongWriter": ModusFlowSongWriter,
    "ModusFlowAudioMixer": ModusFlowAudioMixer,
    "ModusFlowLoadImage": ModusFlowLoadImage,
    "ModusFlowVAEEncode": ModusFlowVAEEncode,
    "ModusFlowVAEDecode": ModusFlowVAEDecode,
    "ModusFlowFidelityController": ModusFlowFidelityController,
    "ModusFlowImg2ImgVAEEncode": ModusFlowImg2ImgVAEEncode,
    "ModusFlowControlNetLoader": ModusFlowControlNetLoader,
    "ModusFlowControlNetApply": ModusFlowControlNetApply,
    "ModusFlowControlNetAllInOne": ModusFlowControlNetAllInOne,
    "ModusFlowLatentUpscale": ModusFlowLatentUpscale,
    "ModusFlowMaskTools": ModusFlowMaskTools,
    "ModusFlowCompareImages": ModusFlowCompareImages,
    "ModusFlowListCurator": ModusFlowListCurator,
    "ModusFlowModelUpscale": ModusFlowModelUpscale,
    "ModusFlowChromaShift": ModusFlowChromaShift,
    "ModusFlowPromptMixer": ModusFlowPromptMixer,
    "ModusFlowSeedController": ModusFlowSeedController,
    "ModusFlowImagePreprocessor": ModusFlowImagePreprocessor,
    "ModusFlowSmartResizer": ModusFlowSmartResizer,
    "ModusFlowFaceSwap": ModusFlowFaceSwap,
    "ModusFlowGlamourController": ModusFlowGlamourController,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "OllamaPromptRefiner": "ModusFlow Ollama Prompt Refiner",
    "ImageForPrompting": "ModusFlow Image For Prompting",
    "ModusFlowBatchKSampler": "ModusFlow Batch KSampler",
    "ModusFlowLoraLoader": "ModusFlow LoRA Loader",
    "ModusFlowUpscaler": "ModusFlow Upscaler",
    "ModusFlowKSampler": "ModusFlow KSampler",
    "ModusFlowModelLoader": "ModusFlow Model Loader",
    "ModusFlowMultiCLIPTextEncode": "ModusFlow Multi-CLIP Text Encode",
    "ModusFlowShowText": "ModusFlow ShowText",
    "ModusFlowTextEditor": "ModusFlow Text Editor",
    "ModusFlowImageGallery": "ModusFlow Image Gallery",
    "ModusFlowLatentPreset": "ModusFlow Latent Preset",
    "ModusFlowSaveAudio": "ModusFlow Save Audio",
    "ModusFlowAceStepAudio": "ModusFlow ACE Step Audio 1.5",
    "OllamaTextRefiner": "ModusFlow Ollama Text Refiner",
    "ModusFlowSaveImage": "ModusFlow Save Image",
    "ModusFlowDetailerSlot": "ModusFlow Detailer Slot",
    "ModusFlowAllInOneDetailer": "ModusFlow All-in-One Detailer",
    "ModusFlowConditioningConcat": "ModusFlow Conditioning Concat",
    "ModusFlowRestormer": "ModusFlow Restormer",
    "ModusDynamicGuidance": "Modus Dynamic Guidance",
    "ModusDeWaxTextureRestore": "Modus De-Wax Texture Restore",
    "ModusFlowVideoLatent": "ModusFlow Video Latent Preset",
    "ModusFlowSaveVideo": "ModusFlow Save Video",
    "ModusFlowSongWriter": "ModusFlow Song Writer & Lyric Studio",
    "ModusFlowAudioMixer": "ModusFlow Audio Mixer & Video Sync",
    "ModusFlowLoadImage": "ModusFlow Load Image",
    "ModusFlowVAEEncode": "ModusFlow VAE Encode",
    "ModusFlowVAEDecode": "ModusFlow VAE Decode",
    "ModusFlowFidelityController": "ModusFlow Fidelity Controller",
    "ModusFlowImg2ImgVAEEncode": "ModusFlow Img2Img VAE Encode",
    "ModusFlowControlNetLoader": "ModusFlow ControlNet Loader",
    "ModusFlowControlNetApply": "ModusFlow Apply ControlNet",
    "ModusFlowControlNetAllInOne": "ModusFlow ControlNet All-in-One",
    "ModusFlowLatentUpscale": "ModusFlow Latent Upscale",
    "ModusFlowMaskTools": "ModusFlow Mask Tools",
    "ModusFlowCompareImages": "ModusFlow Compare Images",
    "ModusFlowListCurator": "ModusFlow List Curator",
    "ModusFlowModelUpscale": "ModusFlow Model Upscale",
    "ModusFlowChromaShift": "ModusFlow Chroma Shift",
    "ModusFlowPromptMixer": "ModusFlow Prompt Mixer",
    "ModusFlowSeedController": "ModusFlow Master Seed",
    "ModusFlowImagePreprocessor": "ModusFlow Image Preprocessor",
    "ModusFlowSmartResizer": "ModusFlow Smart Resizer",
    "ModusFlowFaceSwap": "ModusFlow Face Swapper",
    "ModusFlowGlamourController": "ModusFlow Glamour & Body Sculptor",
}

WEB_DIRECTORY = "./web"

# Initialize and auto-migrate saved directory structure
_auto_migrate_saved_directories()

print("✅ ModusFlow Ollama Prompt Refiner: Custom node loaded.")