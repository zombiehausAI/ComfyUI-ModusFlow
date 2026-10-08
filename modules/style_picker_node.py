"""
ModusFlow Visual Style & Art Aesthetic Picker Node

Provides 1-click aesthetic presets across:
- Fine Art & Painting (Oil Impasto, Watercolor, Ukiyo-e, Art Nouveau, Dark Fantasy)
- Animation & Illustration (90s Cel Anime, Shinkai Cinematic, Comic Ink, Cyberpunk Synthwave, 3D Pixar)
- Editorial & Cinema (Vogue Fashion, National Geographic, Sci-Fi Concept Art)
- Color Palette Harmonies (Warm Golden, Cyber Cyan, Moody Desaturated, Pastel Dreamy)
"""


class ModusFlowStylePicker:
    """
    Visual Style and Art Aesthetic Picker: Injects signature art movements,
    medium textures, and color grading into diffusion prompts and pipes.
    """

    @classmethod
    def INPUT_TYPES(cls):
        styles = [
            "none_photorealistic",
            "vogue_fashion_editorial (clean high-fashion studio, bold styling, avant-garde)",
            "cyberpunk_synthwave (neon grid, holographic glow, electric magenta & cyan)",
            "dark_fantasy_oil (rich impasto brushwork, gothic chiaroscuro, Frank Frazetta aesthetic)",
            "90s_retro_anime (cel shaded, vintage grain, hand-drawn aesthetic, Studio Ghibli vibes)",
            "shinkai_cinematic (dramatic cloudscapes, vivid light rays, lush saturated colors)",
            "watercolor_ink_wash (fluid pigments, translucent paper texture, sumi-e splatter)",
            "ukiyo_e_woodblock (Hokusai woodblock linework, flat decorative tones, washi paper)",
            "art_nouveau_mucha (ornate flowing decorative filigree, golden botanical borders)",
            "comic_book_noir (bold black ink hatching, graphic novel contrast, dynamic halftones)",
            "pixar_3d_stylized (clean subsurface scattering, expressive proportions, soft volumetric lighting)",
            "claymation_stop_motion (tactile plasticine clay texture, subtle fingerprint details)",
            "sci_fi_concept_art (matte painting, epic scale, industrial paneling, Syd Mead inspired)",
            "national_geographic (crisp authentic documentary, true natural colors, tack-sharp)",
            "surrealist_dreamscape (Dali melting architecture, impossible lighting, floating forms)"
        ]

        palettes = [
            "natural_balance",
            "warm_golden_amber (rich honey, warm sunlight, golden highlights)",
            "cool_cyber_cyan (electric teal, deep navy, cool shadows)",
            "monochrome_high_contrast (stark black and pure white, silver mid-tones)",
            "pastel_dreamy (soft lavender, mint green, powder pink, creamy whites)",
            "moody_desaturated (muted olive, charcoal grey, somber atmospheric tones)",
            "vibrant_hyper_saturated (punchy primary colors, bold pop-art vibrancy)"
        ]

        return {
            "required": {
                "style_preset": (styles, {"default": "vogue_fashion_editorial (clean high-fashion studio, bold styling, avant-garde)"}),
                "color_palette": (palettes, {"default": "natural_balance"}),
                "style_strength": ("FLOAT", {"default": 1.0, "min": 0.0, "max": 2.0, "step": 0.1}),
            },
            "optional": {
                "base_prompt": ("STRING", {"multiline": True, "default": ""}),
                "pipe": ("PIPE",),
            }
        }

    RETURN_TYPES = ("STRING", "STRING", "STRING", "PIPE")
    RETURN_NAMES = ("style_tags", "negative_tags", "full_prompt", "pipe")
    FUNCTION = "apply_style"
    CATEGORY = "ModusFlow/Detailing"

    def apply_style(self, style_preset, color_palette, style_strength, base_prompt="", pipe=None):
        style_tokens = {
            "vogue_fashion_editorial": "vogue editorial fashion photography, high fashion avant-garde styling, studio elegance, clean lines, professional retouching",
            "cyberpunk_synthwave": "cyberpunk synthwave aesthetic, neon holographic glow, futuristic reflections, electric cyan and magenta, high-tech dystopian atmosphere",
            "dark_fantasy_oil": "dark fantasy oil painting, heavy textured impasto brushstrokes, rich oil pigments, dramatic baroque lighting, gothic masterpiece",
            "90s_retro_anime": "1990s retro anime aesthetic, hand-drawn animation cel, subtle analog tape grain, vintage color palette, nostalgic anime still",
            "shinkai_cinematic": "makoto shinkai cinematic style, breathtaking detailed skies, brilliant god rays, vibrant hyper-detailed lighting, anime film masterpiece",
            "watercolor_ink_wash": "watercolor and ink wash painting, fluid translucent color bleeds, organic pigment pooling, textured cold-press cotton paper",
            "ukiyo_e_woodblock": "traditional japanese ukiyo-e woodcut print, distinct black outline contours, decorative flat color blocks, hokusai inspired, washi texture",
            "art_nouveau_mucha": "art nouveau illustration, elegant flowing sinuous curves, intricate floral botanical filigree, alphonse mucha inspired, golden decorative motifs",
            "comic_book_noir": "graphic novel comic art, heavy ink cross-hatching, dramatic chiaroscuro noir, gritty comic book paneling, bold lineart",
            "pixar_3d_stylized": "3d stylized animation render, soft tactile subsurface scattering, whimsical charming proportions, octane render quality",
            "claymation_stop_motion": "stop-motion claymation, authentic plasticine clay surface texture, subtle handmade sculpting marks, miniature stage lighting",
            "sci_fi_concept_art": "epic sci-fi concept art, matte painting fidelity, monumental scale, intricate industrial architecture, syd mead inspired",
            "national_geographic": "national geographic documentary photography, tack-sharp telephoto optics, authentic wildlife realism, pristine natural color grading",
            "surrealist_dreamscape": "surrealist dreamscape painting, salvador dali inspired, impossible physics, ethereal floating elements, uncanny beauty"
        }

        palette_tokens = {
            "warm_golden_amber": "warm golden amber color grading, rich honey tones, warm luminous shadows",
            "cool_cyber_cyan": "cool cyan and teal color harmony, electric blue accents, deep oceanic darks",
            "monochrome_high_contrast": "dramatic black and white high contrast, deep ink blacks, crisp silver highlights",
            "pastel_dreamy": "soft pastel color palette, delicate lavender and peach, gentle muted saturation",
            "moody_desaturated": "moody desaturated tones, somber charcoal and slate, subdued atmospheric color grading",
            "vibrant_hyper_saturated": "vibrant saturated color palette, vivid pop art hues, dynamic color intensity"
        }

        tags = []
        key = style_preset.split()[0]
        if key in style_tokens:
            tags.append(style_tokens[key])

        pal_key = color_palette.split()[0]
        if pal_key in palette_tokens:
            tags.append(palette_tokens[pal_key])

        # Apply weighting
        if tags and abs(style_strength - 1.0) > 0.05:
            weighted_tags = [f"({t}:{round(style_strength, 2)})" for t in tags]
            style_str = ", ".join(weighted_tags)
        else:
            style_str = ", ".join(tags)

        # Style negative protections
        negative_tags = "clashing colors, messy composition, low resolution, amateur artwork, watermark, signature"

        # Combine with base_prompt
        if base_prompt.strip():
            full_prompt = f"{base_prompt.strip()}, {style_str}" if style_str else base_prompt.strip()
        else:
            full_prompt = style_str

        return (style_str, negative_tags, full_prompt, pipe)
