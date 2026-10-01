"""
ModusFlow Song Writer & Lyric Studio Node

Provides structured lyric writing, song architecture templates, musical style tags,
and vocal styling tailored for state-of-the-art vocal song generation models (DiffRhythm, YuE).
Outputs formatted lyrics and style prompts ready for music models and ModusFlow Save Audio.
"""

import os

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


class ModusFlowSongWriter:
    """
    ModusFlow Song Writer & Lyric Studio.
    Formats structured lyrics and stylistic prompts for AI singing/song generation models.
    """

    @classmethod
    def INPUT_TYPES(cls):
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
            },
            "optional": {
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
        }

    RETURN_TYPES = ("STRING", "STRING", "STRING", "STRING",)
    RETURN_NAMES = ("style_prompt", "lyrics", "title", "negative_style",)
    FUNCTION = "compose_song"
    CATEGORY = "ModusFlow/Audio"

    def compose_song(self, title, genre, vocal_style, mood, template, lyrics,
                     additional_style="", negative_style=""):
        # 1. Resolve lyrics: if user selected a template and lyrics were empty or default, use template
        active_lyrics = lyrics.strip()
        if not active_lyrics and template in SONG_TEMPLATES:
            active_lyrics = SONG_TEMPLATES[template]

        # 2. Build complete style prompt
        style_parts = []
        if genre != "Custom / Manual":
            style_parts.append(genre)
        if vocal_style != "Instrumental only (no vocals)":
            style_parts.append(vocal_style)
        else:
            style_parts.append("instrumental, no vocals")
        style_parts.append(mood)
        if additional_style.strip():
            style_parts.append(additional_style.strip())

        full_style_prompt = ", ".join(style_parts)

        # 3. Clean and format lyrics with standard section headers
        cleaned_lyrics = active_lyrics.replace("\r\n", "\n")

        print(f"[ModusFlow SongWriter] Composed '{title}' | Style: {full_style_prompt[:60]}... | Lyrics: {len(cleaned_lyrics.splitlines())} lines")

        return (full_style_prompt, cleaned_lyrics, title, negative_style)


NODE_CLASS_MAPPINGS = {
    "ModusFlowSongWriter": ModusFlowSongWriter
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "ModusFlowSongWriter": "ModusFlow Song Writer & Lyric Studio"
}
