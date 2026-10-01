"""
ModusFlow Song Writer & Lyric Studio Node

Provides structured lyric writing, song architecture templates, musical style tags,
and vocal styling tailored for state-of-the-art vocal song generation models (DiffRhythm, YuE).
Outputs formatted lyrics and style prompts ready for music models and ModusFlow Save Audio.
"""

import os
import json
import re
from ..config import settings
from .modusflow_utils import (
    get_ollama_models,
    query_llm,
    perform_web_search,
    sanitize_llm_output,
)

# Standard song structure templates
SONG_TEMPLATES = {
    "Standard Pop/Rock": (
        "[intro]\n"
        "(Melodic acoustic intro with gentle atmosphere)\n\n"
        "[verse 1]\n"
        "Walking through the city in the fading light\n"
        "Shadows dancing slowly in the neon night\n"
        "Every whisper on the wind reminds me where we started\n\n"
        "[chorus]\n"
        "Hold on to the fire burning in our souls\n"
        "We can find the pieces that will make us whole\n"
        "Through the rising storm and the falling rain\n"
        "Nothing can divide us once again\n\n"
        "[verse 2]\n"
        "Footsteps echo softly on the pavement stone\n"
        "Looking for a sign that we are not alone\n"
        "Turning every corner with a heartbeat strong\n\n"
        "[chorus]\n"
        "Hold on to the fire burning in our souls\n"
        "We can find the pieces that will make us whole\n"
        "Through the rising storm and the falling rain\n"
        "Nothing can divide us once again\n\n"
        "[bridge]\n"
        "When the darkness tries to take the dawn\n"
        "We keep moving, we keep pushing on\n\n"
        "[chorus]\n"
        "Hold on to the fire burning in our souls\n"
        "We can find the pieces that will make us whole\n"
        "Through the rising storm and the falling rain\n"
        "Nothing can divide us once again\n\n"
        "[outro]\n"
        "Once again, once again\n"
        "Hold on to the fire\n"
        "(Fading gently with guitar resonance)"
    ),
    "Acoustic Ballad / Folk": (
        "[intro]\n"
        "(Delicate fingerpicked guitar with soft harmonica)\n\n"
        "[verse 1]\n"
        "Dust on the window, sun on the floor\n"
        "I watch the morning knock on my door\n"
        "Memories wandering back to the stream\n"
        "Where we traded a lifetime for one little dream\n\n"
        "[chorus]\n"
        "Oh, time rolls like a river to sea\n"
        "Carrying all that you used to be\n"
        "And the seasons change but the echoes stay\n"
        "In the quiet moments of the day\n\n"
        "[verse 2]\n"
        "The oak tree is leaning where the old fence fell\n"
        "More stories to whisper than a voice can tell\n"
        "I pack up the guitar and step out in the breeze\n"
        "Listening to secrets in the autumn trees\n\n"
        "[chorus]\n"
        "Oh, time rolls like a river to sea\n"
        "Carrying all that you used to be\n"
        "And the seasons change but the echoes stay\n"
        "In the quiet moments of the day\n\n"
        "[outro]\n"
        "Softly now, softly down the road\n"
        "(Harmonica solo fades out)"
    ),
    "Cinematic Epic / Rock": (
        "[intro]\n"
        "(Thunderous low percussion, rising synth brass, sweeping strings)\n\n"
        "[verse 1]\n"
        "Across the frozen mountain crest\n"
        "The weary warriors find no rest\n"
        "Banners torn against the sky\n"
        "Hear the call that will never die\n\n"
        "[pre-chorus]\n"
        "The drums beat louder, the line will hold\n"
        "Written in iron, remembered in gold\n\n"
        "[chorus]\n"
        "Rise up from the ashes, stand against the night\n"
        "We are the thunder, we are the light\n"
        "Forever unyielding, forever we reign\n"
        "Born of the fire, breaking the chain\n\n"
        "[verse 2]\n"
        "The fortress gates are opening wide\n"
        "A thousand shadows side by side\n"
        "No retreat and no defeat\n"
        "Feel the rhythm of destiny's beat\n\n"
        "[chorus]\n"
        "Rise up from the ashes, stand against the night\n"
        "We are the thunder, we are the light\n"
        "Forever unyielding, forever we reign\n"
        "Born of the fire, breaking the chain\n\n"
        "[outro]\n"
        "(Crescendo with heavy drums and soaring electric guitar)"
    ),
    "Synthwave / Cyberpunk": (
        "[intro]\n"
        "(Analog arpeggios, driving retro 808 kick, sweeping filter pad)\n\n"
        "[verse 1]\n"
        "Midnight highway, purple neon glow\n"
        "Digital signals moving high and low\n"
        "Reflections flash across the visor screen\n"
        "Lost in a simulated dream\n\n"
        "[chorus]\n"
        "Electric pulse running in my veins\n"
        "Synthetic love breaking all the chains\n"
        "Under the chrome sky we ride tonight\n"
        "Chasing the frequency into the light\n\n"
        "[verse 2]\n"
        "Speedometer climbing past eighty-four\n"
        "Bassline vibrating right through the floor\n"
        "No destination, just the open track\n"
        "Once we begin we are never turning back\n\n"
        "[chorus]\n"
        "Electric pulse running in my veins\n"
        "Synthetic love breaking all the chains\n"
        "Under the chrome sky we ride tonight\n"
        "Chasing the frequency into the light\n\n"
        "[outro]\n"
        "(Synth lead solo with gated reverb drums fading out)"
    ),
}

GENRE_STYLES = [
    "Indie Folk Ballad, acoustic guitar picking, harmonica, warm intimate",
    "Cinematic Epic Rock, thunderous drums, soaring electric guitar, orchestral",
    "80s Synthwave, analog synth arpeggios, driving punchy retro drums, neon atmosphere",
    "Modern Pop Dance, catchy upbeat melody, rhythmic synth bass, energetic",
    "Alternative Rock, distorted rhythm guitar, punchy drums, emotional melodic",
    "Acoustic Ballad, piano, cello, gentle fingerpicked guitar, heartfelt",
    "Cyberpunk Industrial, heavy dark synths, gritty bassline, aggressive pulse",
    "Lo-Fi Chillhop, vinyl crackle, mellow rhodes keys, relaxed groove",
    "Country Americana, steel guitar, acoustic rhythm, stomp claps, storytelling",
    "Melodic Metal, heavy chugging riffs, soaring harmonic chorus, double kick",
    "R&B Soul, smooth electric piano, groovy bass, sensual melodic vocal runs",
    "Custom / Manual",
]

VOCAL_STYLES = [
    "Female vocal, emotional, expressive, clear tone",
    "Female vocal, powerful belted, resonant, passionate",
    "Male vocal, gritty, raspy, authentic, heartfelt",
    "Male vocal, smooth baritone, rich, warm delivery",
    "Duet, male and female harmonies, interwoven vocals",
    "Whispered ethereal vocal, dreamy, intimate, breathy",
    "Choir harmonies, layered multi-voice chorus, anthemic",
    "Instrumental only (no vocals)",
]

MOOD_TAGS = [
    "Emotional, heartfelt, nostalgic, melancholic",
    "Energetic, driving, uplifting, inspiring",
    "Atmospheric, dreamy, ethereal, floating",
    "Dark, brooding, dramatic, tense",
    "Warm, comforting, peaceful, gentle",
    "Intense, triumphant, heroic, grand",
    "Groovy, upbeat, celebratory, fun",
]


DEFAULT_STRUCTURE_GUIDE = (
    "[Song Structure Guide]\n"
    "[intro] - (Atmospheric instrumentation description in parentheses)\n"
    "[verse 1] - 4 lines establishing the narrative, setting the scene with vivid imagery\n"
    "[pre-chorus] - 2 lines building harmonic tension and emotional anticipation\n"
    "[chorus] - 4 anthemic lines with strong meter and memorable vocal hooks\n"
    "[verse 2] - 4 lines advancing the story or changing perspective\n"
    "[pre-chorus] - 2 lines building back up\n"
    "[chorus] - Full energetic chorus\n"
    "[bridge] - 2-4 lines providing a melodic or thematic twist / climax\n"
    "[chorus] - Final soaring chorus\n"
    "[outro] - 2-4 lines with fading vocal resonance and instrumental cues"
)

AI_MODES = ["disabled", "generate_new", "refine_existing"]
AI_PROVIDERS = [
    "Ollama (Local)",
    "Ollama (Cloud)",
    "Cloud (OpenAI / OpenRouter / Groq / DeepSeek)",
]

def _parse_song_llm_json(raw_text: str) -> dict:
    """Parses JSON output from LLM, with fallback handling for markdown codeblocks or raw text."""
    text = (raw_text or "").strip()
    if not text:
        return {}

    match = re.search(r'```(?:json)?\s*(\{[\s\S]*?\})\s*```', text)
    if match:
        try:
            return json.loads(match.group(1))
        except Exception:
            pass

    match = re.search(r'(\{[\s\S]*\})', text)
    if match:
        try:
            return json.loads(match.group(1))
        except Exception:
            pass

    try:
        return json.loads(text)
    except Exception:
        return {"lyrics": text}


class ModusFlowSongWriter:
    """
    ModusFlow Song Writer & Lyric Studio.
    Formats structured lyrics and stylistic prompts for AI singing/song generation models.
    Supports saving and loading songs to the unified prompts directory as JSON files,
    plus full AI generation and refinement via local Ollama, cloud Ollama, or OpenAI-compatible cloud models.
    """

    @classmethod
    def get_saved_songs(cls):
        """Get list of saved songs from the configured unified prompts directory (songs/ subdirectory and root)."""
        try:
            from ..config import settings, BASE_DIR
            prompts_dir = settings.get('prompts_save_directory', '').strip()
            if not prompts_dir:
                prompts_dir = os.path.join(BASE_DIR, 'saved_prompts')

            seen = set()
            files = []
            scan_dirs = [os.path.join(prompts_dir, 'songs'), prompts_dir, os.path.join(BASE_DIR, 'saved_songs')]
            for d in scan_dirs:
                if os.path.isdir(d):
                    for f in sorted(os.listdir(d)):
                        if f.endswith('.json') and f not in seen:
                            seen.add(f)
                            files.append(f)
            if files:
                files.sort()
                return ["--select song--"] + files
        except Exception as e:
            print(f"[ModusFlow SongWriter] Error loading songs list: {e}")

        return ["--no songs found--"]

    @classmethod
    def INPUT_TYPES(cls):
        saved_songs = cls.get_saved_songs()
        template_names = ["Custom"] + list(SONG_TEMPLATES.keys())
        return {
            "required": {
                "title": ("STRING", {"default": "Echoes in the Wind", "multiline": False}),
                "genre": (GENRE_STYLES, {"default": GENRE_STYLES[0]}),
                "vocal_style": (VOCAL_STYLES, {"default": VOCAL_STYLES[0]}),
                "mood": (MOOD_TAGS, {"default": MOOD_TAGS[0]}),
                "template": (template_names, {"default": "Standard Pop/Rock"}),
                "lyrics": ("STRING", {
                    "default": SONG_TEMPLATES["Standard Pop/Rock"],
                    "multiline": True
                }),
                "saved_song": (saved_songs, {"default": saved_songs[0] if saved_songs else ""}),
            },
            "optional": {
                "ai_mode": (AI_MODES, {"default": "disabled"}),
                "ai_provider": (AI_PROVIDERS, {"default": "Ollama (Local)"}),
                "ollama_model": (get_ollama_models(settings.get('ollama_url')),),
                "cloud_model": ("STRING", {
                    "default": settings.get("cloud_model", "deepseek/deepseek-chat"),
                    "multiline": False
                }),
                "topic_or_subject": ("STRING", {
                    "default": "",
                    "multiline": True,
                    "placeholder": "Subject, story, theme, or revision instructions..."
                }),
                "web_search": (["disabled", "enabled"], {"default": "disabled"}),
                "structure_guide": ("STRING", {
                    "default": DEFAULT_STRUCTURE_GUIDE,
                    "multiline": True
                }),
                "temperature": ("FLOAT", {"default": 0.75, "min": 0.0, "max": 2.0, "step": 0.05, "display": "slider"}),
                "seed": ("INT", {"default": 0, "min": 0, "max": 0xffffffffffffffff}),
                "additional_style": ("STRING", {
                    "default": "",
                    "multiline": False,
                    "placeholder": "Extra style descriptors (e.g. reverb, 120 bpm, minor key, 90s aesthetic)"
                }),
                "negative_style": ("STRING", {
                    "default": "harsh noise, clipping, distorted vocals, out of tune, robotic glitch",
                    "multiline": False
                }),
            },
            "hidden": {
                "unique_id": "UNIQUE_ID",
                "extra_pnginfo": "EXTRA_PNGINFO",
            },
        }

    RETURN_TYPES = ("STRING", "STRING", "STRING", "STRING",)
    RETURN_NAMES = ("style_prompt", "lyrics", "title", "negative_style",)
    FUNCTION = "compose_song"
    CATEGORY = "ModusFlow/Audio"

    def compose_song(self, title, genre, vocal_style, mood, template, lyrics,
                     saved_song=None, ai_mode="disabled", ai_provider="Ollama (Local)",
                     ollama_model="", cloud_model="", topic_or_subject="",
                     web_search="disabled", structure_guide="", temperature=0.75,
                     seed=0, additional_style="", negative_style="",
                     unique_id=None, extra_pnginfo=None):
        active_title = title.strip()
        active_genre = genre
        active_vocal = vocal_style
        active_mood = mood
        active_lyrics = lyrics.strip()
        active_additional = additional_style.strip()

        # 1. AI Generation / Refinement if enabled
        if ai_mode in ("generate_new", "refine_existing"):
            model_name = ""
            if ai_provider == "Cloud (OpenAI / OpenRouter / Groq / DeepSeek)":
                model_name = (cloud_model or "").strip() or settings.get("cloud_model", "deepseek/deepseek-chat")
            else:
                model_name = (ollama_model or "").strip()

            search_context = ""
            if web_search == "enabled" and topic_or_subject.strip():
                print(f"[ModusFlow SongWriter] Searching web for topic: '{topic_or_subject.strip()}'...")
                search_context = perform_web_search(topic_or_subject.strip())
                if search_context:
                    print(f"[ModusFlow SongWriter] Found web research context to ground lyrics.")

            system_prompt = (
                "You are an acclaimed songwriter, lyricist, and music producer. "
                "Produce a complete, cohesive song package with structured lyrics and musical descriptors "
                "tailored for AI singing and music generation models (such as ACE-Step, DiffRhythm, YuE).\n\n"
                "You MUST output your response strictly as a single JSON object with the following keys:\n"
                "{\n"
                '  "title": "Evocative, memorable song title",\n'
                '  "genre": "Genre styling tags (e.g. 80s Synthwave, Indie Folk Ballad, etc.)",\n'
                '  "vocal_style": "Vocal delivery tags (e.g. Female vocal, clear tone / Male gritty baritone)",\n'
                '  "mood": "Emotional mood description",\n'
                '  "additional_style": "Specific instrumentation, BPM, key, texture tags",\n'
                '  "lyrics": "Full song lyrics formatted with section tags like [intro], [verse 1], [pre-chorus], [chorus], [verse 2], [bridge], [outro], with instrumental and vocal cues in parentheses (e.g. (acoustic guitar picking), (soaring vocals))."\n'
                "}\n"
                "Strict rule: Output ONLY the valid JSON object. Do not include any greeting, preamble, or commentary outside the JSON."
            )

            guide_text = structure_guide.strip() or DEFAULT_STRUCTURE_GUIDE

            if ai_mode == "generate_new":
                user_prompt = (
                    "Compose a brand new original song based on the following creative direction.\n"
                    f"Subject / Story / Theme: {topic_or_subject.strip() or active_title or 'An epic cinematic journey'}\n"
                    f"Desired Genre Style: {active_genre}\n"
                    f"Desired Vocal Style: {active_vocal}\n"
                    f"Desired Mood: {active_mood}\n"
                )
            else:  # refine_existing
                user_prompt = (
                    "Refine, polish, and elevate this existing song. Tighten rhyme schemes, enhance rhythmic meter, "
                    "deepen imagery, and optimize structure while honoring the core intent.\n"
                    f"Current Title: {active_title}\n"
                    f"Current Genre: {active_genre}\n"
                    f"Current Vocal Style: {active_vocal}\n"
                    f"Current Mood: {active_mood}\n"
                    f"Current Additional Descriptors: {active_additional}\n"
                    f"Current Lyrics:\n{active_lyrics}\n"
                )
                if topic_or_subject.strip():
                    user_prompt += f"\nSpecific User Refinement Instructions:\n{topic_or_subject.strip()}\n"

            if search_context:
                user_prompt += f"\n[Factual Research Context]:\n{search_context}\n"

            user_prompt += f"\n[Song Structure & Formatting Guide]:\n{guide_text}\n"

            print(f"[ModusFlow SongWriter] Querying {ai_provider} ({model_name}) for song {ai_mode}...")
            try:
                raw_response = query_llm(
                    provider=ai_provider,
                    model=model_name,
                    system_prompt=system_prompt,
                    user_prompt=user_prompt,
                    temperature=temperature,
                    max_tokens=3000,
                    seed=seed
                )
                parsed = _parse_song_llm_json(raw_response)
                if parsed.get("title"):
                    active_title = str(parsed["title"]).strip()
                if parsed.get("genre"):
                    active_genre = str(parsed["genre"]).strip()
                if parsed.get("vocal_style"):
                    active_vocal = str(parsed["vocal_style"]).strip()
                if parsed.get("mood"):
                    active_mood = str(parsed["mood"]).strip()
                if parsed.get("additional_style"):
                    active_additional = str(parsed["additional_style"]).strip()
                if parsed.get("lyrics"):
                    active_lyrics = str(parsed["lyrics"]).strip()

                print(f"[ModusFlow SongWriter] Successfully generated/refined song '{active_title}'!")
            except Exception as e:
                print(f"[ModusFlow SongWriter] AI generation error: {e}. Falling back to input values.")

        # 2. Resolve fallback lyrics if empty
        if not active_lyrics and template in SONG_TEMPLATES:
            active_lyrics = SONG_TEMPLATES[template]

        # 3. Build complete style prompt
        style_parts = []
        if active_genre != "Custom / Manual":
            style_parts.append(active_genre)
        if active_vocal != "Instrumental only (no vocals)":
            style_parts.append(active_vocal)
        else:
            style_parts.append("instrumental, no vocals")
        style_parts.append(active_mood)
        if active_additional:
            style_parts.append(active_additional)

        full_style_prompt = ", ".join(style_parts)

        # 4. Clean and format lyrics with standard section headers
        cleaned_lyrics = active_lyrics.replace("\r\n", "\n")

        # 5. Update workflow metadata if available
        if unique_id is not None and extra_pnginfo is not None:
            if isinstance(extra_pnginfo, dict) and "workflow" in extra_pnginfo:
                workflow = extra_pnginfo["workflow"]
                node = next((x for x in workflow.get("nodes", []) if str(x.get("id")) == str(unique_id)), None)
                if node:
                    node["widgets_values"] = [
                        active_title, active_genre, active_vocal, active_mood, template,
                        cleaned_lyrics, saved_song, ai_mode, ai_provider, ollama_model,
                        cloud_model, topic_or_subject, web_search, structure_guide,
                        temperature, seed, active_additional, negative_style
                    ]

        print(f"[ModusFlow SongWriter] Composed '{active_title}' | Style: {full_style_prompt[:60]}... | Lyrics: {len(cleaned_lyrics.splitlines())} lines")

        return (full_style_prompt, cleaned_lyrics, active_title, negative_style)


NODE_CLASS_MAPPINGS = {
    "ModusFlowSongWriter": ModusFlowSongWriter
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "ModusFlowSongWriter": "ModusFlow Song Writer & Lyric Studio"
}
