"""
ModusFlow Virtual Studio Director & Style Preset Node

A photographer's cockpit providing one-touch controls for:
- Camera Lens / Focal Length (24mm, 50mm, 85mm portrait, 135mm telephoto)
- Camera Angle & Framing (Eye level, low heroic angle, high angle, Dutch tilt, aerial)
- Studio & Cinematic Lighting (Golden hour, Rembrandt, Cyberpunk neon, Softbox, Chiaroscuro)
- Film Stocks & Color Grading (Kodak Portra, Fuji Superia, Cinestill 800T, Ilford B&W)
- Aperture & Depth of Field (f/1.2 creamy bokeh to f/11 deep focus)
- Atmospheric Elements (Dust particles, morning mist, anamorphic lens flares)
"""


class ModusFlowStudioDirector:
    """
    Virtual Studio Director node: Injects professional photography, lighting,
    camera optics, and film stock aesthetics into generation conditioning.
    """

    @classmethod
    def INPUT_TYPES(cls):
        focal_lengths = [
            "default_natural",
            "14mm_ultra_wide (epic panoramic & dynamic distortion)",
            "24mm_wide_angle (environmental storytelling)",
            "35mm_street (classic documentary & environmental portrait)",
            "50mm_standard (natural human eye perspective)",
            "85mm_portrait (flattering compression & creamy bokeh)",
            "135mm_telephoto (strong background separation & compression)",
            "200mm_super_telephoto (extreme isolation & flat field)",
            "macro_extreme_close_up (microscopic detail & texture)"
        ]

        camera_angles = [
            "eye_level (neutral & direct)",
            "low_angle_heroic (dominant, powerful upward perspective)",
            "high_angle_vulnerable (downward perspective & contextual)",
            "dutch_angle (cinematic dynamic tilted frame)",
            "over_the_shoulder (cinematic narrative engagement)",
            "birds_eye_aerial (top-down geometric view)",
            "ground_level_worms_eye (dramatic floor-level perspective)"
        ]

        lighting_schemes = [
            "natural_diffused",
            "golden_hour (warm low-angle sunlight, long golden shadows)",
            "rembrandt_portrait (dramatic triangle cheek highlight, moody)",
            "cyberpunk_neon (dual-tone electric blue and hot magenta)",
            "softbox_studio (clean beauty lighting, soft diffused shadows)",
            "chiaroscuro_noir (high contrast, deep dramatic black shadows)",
            "volumetric_god_rays (hazy atmospheric shafts of sunlight)",
            "backlit_rim_light (dramatic halo silhouette edge glow)",
            "overcast_soft_light (shadowless, even skin tones, gentle)",
            "bioluminescent_ambient (ethereal otherworldly glowing illumination)"
        ]

        film_stocks = [
            "digital_clean_modern",
            "kodak_portra_400 (warm flattering skin tones, gentle pastels)",
            "fujifilm_superia (cool crisp greens, punchy magenta tones)",
            "cinestill_800t (tungsten night photography with red halation)",
            "ilford_hp5_bw (classic medium-format monochrome, rich grain)",
            "vintage_polaroid_600 (warm fade, nostalgic vignette, soft focus)",
            "kodachrome_64 (bold 1970s saturated colors and deep contrast)",
            "technicolor_3_strip (lush golden age Hollywood cinematic tones)"
        ]

        apertures = [
            "balanced_f4 (moderate depth of field)",
            "f1.2_ultra_shallow (creamy melted background, circular bokeh balls)",
            "f1.8_portrait_bokeh (sharp subject, beautifully blurred background)",
            "f2.8_subtle_blur (natural depth separation)",
            "f8_sharp_field (detailed background and environment)",
            "f11_deep_focus (razor-sharp edge-to-edge landscape focus)"
        ]

        atmospheres = [
            "clear_air",
            "volumetric_dust (glowing dust motes dancing in light)",
            "morning_mist (atmospheric gentle ground haze)",
            "rainy_reflections (glistening wet surfaces and rain droplets)",
            "anamorphic_lens_flare (horizontal blue streak cinematic flare)",
            "subtle_smoke_haze (moody atmospheric club or stage fog)"
        ]

        return {
            "required": {
                "focal_length": (focal_lengths, {"default": "85mm_portrait (flattering compression & creamy bokeh)"}),
                "camera_angle": (camera_angles, {"default": "eye_level (neutral & direct)"}),
                "lighting": (lighting_schemes, {"default": "golden_hour (warm low-angle sunlight, long golden shadows)"}),
                "film_stock": (film_stocks, {"default": "kodak_portra_400 (warm flattering skin tones, gentle pastels)"}),
                "aperture": (apertures, {"default": "f1.8_portrait_bokeh (sharp subject, beautifully blurred background)"}),
                "atmosphere": (atmospheres, {"default": "clear_air"}),
                "effect_strength": ("FLOAT", {"default": 1.0, "min": 0.0, "max": 2.0, "step": 0.1}),
            },
            "optional": {
                "base_prompt": ("STRING", {"multiline": True, "default": ""}),
                "pipe": ("PIPE",),
            }
        }

    RETURN_TYPES = ("STRING", "STRING", "STRING", "PIPE")
    RETURN_NAMES = ("positive_tags", "negative_tags", "full_prompt", "pipe")
    FUNCTION = "direct_scene"
    CATEGORY = "ModusFlow/Detailing"

    def direct_scene(self, focal_length, camera_angle, lighting, film_stock,
                     aperture, atmosphere, effect_strength, base_prompt="", pipe=None):

        # Map choices to rich prompt tokens
        tags = []

        # 1. Focal length
        lens_clean = focal_length.split()[0].replace("_", " ")
        if "default" not in lens_clean:
            tags.append(f"shot on {lens_clean} lens")

        # 2. Camera angle
        angle_clean = camera_angle.split()[0].replace("_", " ")
        if "eye_level" not in angle_clean:
            tags.append(f"{angle_clean} shot")

        # 3. Lighting
        light_clean = lighting.split()[0].replace("_", " ")
        if "natural" not in light_clean:
            tags.append(f"{light_clean} lighting")

        # 4. Film stock
        stock_clean = film_stock.split()[0].replace("_", " ")
        if "digital" not in stock_clean:
            tags.append(f"{stock_clean} film stock aesthetic")

        # 5. Aperture
        ap_clean = aperture.split()[0].replace("_", " ")
        if "balanced" not in ap_clean:
            tags.append(f"{ap_clean} aperture depth of field")

        # 6. Atmosphere
        atm_clean = atmosphere.split()[0].replace("_", " ")
        if "clear" not in atm_clean:
            tags.append(f"{atm_clean}")

        # Scale weights with effect_strength
        weighted_tags = []
        for t in tags:
            if abs(effect_strength - 1.0) > 0.05:
                weighted_tags.append(f"({t}:{round(effect_strength, 2)})")
            else:
                weighted_tags.append(t)

        positive_tags = ", ".join(weighted_tags)

        # Standard negative photography protections
        negative_tags = (
            "harsh flash glare, flat lighting, blown-out highlights, "
            "unflattering shadows, muddy color grading, lens distortion"
        )

        # Combine with base_prompt
        if base_prompt.strip():
            full_prompt = f"{base_prompt.strip()}, {positive_tags}" if positive_tags else base_prompt.strip()
        else:
            full_prompt = positive_tags

        return (positive_tags, negative_tags, full_prompt, pipe)
