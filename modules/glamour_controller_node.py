"""
ModusFlow Glamour & Body Sculpt Controller Node

Provides dedicated, intuitive visual sliders and dropdowns for:
- Facial transformation: Age shift, smile intensity, ethnicity, and skin glow.
- Cosmetics: Hair color and eye color.
- Body sculpting: Breasts scale (enlarge/reduce), waist cinch, hips & butt, thigh thickness, and muscle tone.
- Automatic denoise calculation: Computes the exact required inpainting denoise and prompts dynamically.
"""


class ModusFlowGlamourController:
    """
    Intuitive slider-driven controller for character glamour, aging, ethnicity,
    and anatomical sculpting (bust, waist, hips, thighs, muscle).
    """

    @classmethod
    def INPUT_TYPES(cls):
        hair_colors = [
            "keep_original", "platinum_blonde", "golden_blonde", "rich_brunette",
            "raven_black", "auburn_copper", "pastel_pink", "emerald_green",
            "sapphire_blue", "silver_grey"
        ]

        eye_colors = [
            "keep_original", "ice_blue", "emerald_green", "warm_hazel",
            "dark_brown", "amber_gold", "violet"
        ]

        ethnicities = [
            "keep_original", "caucasian", "east_asian", "south_asian",
            "black_african", "latina_hispanic", "middle_eastern", "nordic"
        ]

        return {
            "required": {
                # --- Facial & Identity ---
                "age_shift": ("FLOAT", {"default": 0.0, "min": -5.0, "max": 5.0, "step": 0.1}),
                "ethnicity": (ethnicities, {"default": "keep_original"}),
                "smile_intensity": ("FLOAT", {"default": 0.0, "min": 0.0, "max": 1.0, "step": 0.05}),
                "skin_glow": ("FLOAT", {"default": 0.0, "min": 0.0, "max": 1.0, "step": 0.05}),

                # --- Hair & Eyes ---
                "hair_color": (hair_colors, {"default": "keep_original"}),
                "eye_color": (eye_colors, {"default": "keep_original"}),

                # --- Body & Silhouette Sculpting ---
                "breasts_scale": ("FLOAT", {"default": 0.0, "min": -5.0, "max": 5.0, "step": 0.1}),
                "waist_cinch": ("FLOAT", {"default": 0.0, "min": -5.0, "max": 5.0, "step": 0.1}),
                "hips_and_butt": ("FLOAT", {"default": 0.0, "min": -5.0, "max": 5.0, "step": 0.1}),
                "thigh_thickness": ("FLOAT", {"default": 0.0, "min": -5.0, "max": 5.0, "step": 0.1}),
                "muscle_tone": ("FLOAT", {"default": 0.0, "min": 0.0, "max": 5.0, "step": 0.1}),
            },
            "optional": {
                "base_positive": ("STRING", {"multiline": True, "default": ""}),
                "base_negative": ("STRING", {"multiline": True, "default": ""}),
            }
        }

    RETURN_TYPES = (
        "STRING", "FLOAT",  # face_prompt, face_denoise
        "STRING", "FLOAT",  # eyes_prompt, eyes_denoise
        "STRING", "FLOAT",  # chest_prompt, chest_denoise
        "STRING", "FLOAT",  # hips_prompt, hips_denoise
        "STRING", "STRING"   # master_positive, master_negative
    )
    RETURN_NAMES = (
        "face_prompt", "face_denoise",
        "eyes_prompt", "eyes_denoise",
        "chest_prompt", "chest_denoise",
        "hips_prompt", "hips_denoise",
        "master_positive", "master_negative"
    )
    FUNCTION = "generate_sculpt_controls"
    CATEGORY = "ModusFlow/Detailing"

    def generate_sculpt_controls(self, age_shift, ethnicity, smile_intensity, skin_glow,
                                 hair_color, eye_color, breasts_scale, waist_cinch,
                                 hips_and_butt, thigh_thickness, muscle_tone,
                                 base_positive="", base_negative=""):

        # ------------------------------------------------------------------
        # 1. Face & Identity Slot
        # ------------------------------------------------------------------
        face_tags = []
        face_offset = 0.0

        # Age
        if age_shift < -0.3:
            mag = abs(age_shift)
            if mag >= 3.0:
                face_tags.append("extremely youthful teen complexion, soft features, smooth skin")
            else:
                face_tags.append("youthful 20-year-old radiant skin, fresh smooth features")
            face_offset = max(face_offset, 0.40 + mag * 0.04)
        elif age_shift > 0.3:
            if age_shift >= 3.0:
                face_tags.append("distinguished elderly mature appearance, silver laugh lines, dignified features")
            else:
                face_tags.append("mature 45-year-old distinguished elegance, subtle laugh lines, natural texture")
            face_offset = max(face_offset, 0.42 + age_shift * 0.04)

        # Ethnicity
        ethnic_prompts = {
            "east_asian": "East Asian descent, delicate almond eyes, porcelain complexion",
            "south_asian": "South Asian descent, warm amber skin undertone, expressive features",
            "black_african": "Black African descent, gorgeous melanin-rich skin tone, striking features",
            "latina_hispanic": "Latina Hispanic descent, warm golden olive complexion, stunning features",
            "middle_eastern": "Middle Eastern descent, rich almond eyes, defined cheekbones",
            "nordic": "Nordic Scandinavian descent, fair complexion, sculpted features",
            "caucasian": "refined Caucasian features, natural skin undertones"
        }
        if ethnicity in ethnic_prompts:
            face_tags.append(ethnic_prompts[ethnicity])
            face_offset = max(face_offset, 0.58)

        # Smile
        if smile_intensity > 0.05:
            if smile_intensity >= 0.7:
                face_tags.append("radiant wide joyful smile, visible neat white teeth, happy expression")
            else:
                face_tags.append("warm charming subtle smile, pleasant expression")
            face_offset = max(face_offset, 0.38 + smile_intensity * 0.15)

        # Skin Glow
        if skin_glow > 0.05:
            face_tags.append("luminous glowing dewy skin, natural subsurface scattering, soft healthy sheen")
            face_offset = max(face_offset, 0.35)

        face_prompt = ", ".join(face_tags) if face_tags else "photorealistic facial detail, sharp focus, natural skin"
        face_denoise = min(0.70, round(face_offset, 2)) if face_offset > 0.0 else 0.30

        # ------------------------------------------------------------------
        # 2. Eyes & Hair Slot
        # ------------------------------------------------------------------
        eye_hair_tags = []
        eye_hair_offset = 0.0

        eye_map = {
            "ice_blue": "striking ice-blue iris, vivid catchlights",
            "emerald_green": "stunning emerald-green iris, detailed pupil",
            "warm_hazel": "warm hazel-green eyes with golden specks",
            "dark_brown": "deep dark brown expressive eyes",
            "amber_gold": "rare glowing amber-gold eyes",
            "violet": "exotic amethyst violet iris"
        }
        if eye_color in eye_map:
            eye_hair_tags.append(eye_map[eye_color])
            eye_hair_offset = max(eye_hair_offset, 0.38)

        hair_map = {
            "platinum_blonde": "silky platinum blonde hair, natural hair shine",
            "golden_blonde": "glossy warm golden blonde hair, healthy strands",
            "rich_brunette": "luxurious rich chocolate brunette hair",
            "raven_black": "glossy jet black hair, soft highlights",
            "auburn_copper": "vibrant auburn copper hair, fiery undertones",
            "pastel_pink": "aesthetic pastel pink dyed hair, stylish color",
            "emerald_green": "vibrant dark emerald green hair",
            "sapphire_blue": "glossy midnight sapphire blue hair",
            "silver_grey": "elegant silver-grey hair with pearlescent sheen"
        }
        if hair_color in hair_map:
            eye_hair_tags.append(hair_map[hair_color])
            eye_hair_offset = max(eye_hair_offset, 0.55)

        eyes_prompt = ", ".join(eye_hair_tags) if eye_hair_tags else "detailed eyes, natural iris, clean hair strands"
        eyes_denoise = min(0.65, round(eye_hair_offset, 2)) if eye_hair_offset > 0.0 else 0.28

        # ------------------------------------------------------------------
        # 3. Chest & Breasts Sculpt Slot
        # ------------------------------------------------------------------
        chest_tags = []
        chest_offset = 0.0

        if breasts_scale < -0.3:
            mag = abs(breasts_scale)
            if mag >= 3.0:
                chest_tags.append("petite flat slender chest, athletic trim bust, fitted tailored garment drape")
            else:
                chest_tags.append("modest petite bust, natural feminine chest proportions, fitted clothing")
            chest_offset = max(chest_offset, 0.55 + mag * 0.035)
        elif breasts_scale > 0.3:
            if breasts_scale >= 3.5:
                chest_tags.append("voluptuous prominent large bust, curvaceous chest, flattering fitted neckline, natural fabric stretch")
            elif breasts_scale >= 1.8:
                chest_tags.append("full shapely bust, generous feminine curves, tailored clothing drape with realistic tension")
            else:
                chest_tags.append("gently enhanced natural bust, shapely chest contour, flattering garment fit")
            chest_offset = max(chest_offset, 0.58 + breasts_scale * 0.032)

        if muscle_tone > 0.2:
            if muscle_tone >= 3.0:
                chest_tags.append("athletic defined musculature, sculpted pectoral contour, toned upper body")
            else:
                chest_tags.append("toned upper body, athletic definition, subtle collarbone highlights")
            chest_offset = max(chest_offset, 0.52 + muscle_tone * 0.03)

        chest_prompt = ", ".join(chest_tags) if chest_tags else "upper torso contour, natural garment drape, realistic fabric"
        chest_denoise = min(0.78, round(chest_offset, 2)) if chest_offset > 0.0 else 0.35

        # ------------------------------------------------------------------
        # 4. Waist, Hips, Butt & Thighs Slot
        # ------------------------------------------------------------------
        hips_tags = []
        hips_offset = 0.0

        # Waist
        if waist_cinch < -0.3:
            mag = abs(waist_cinch)
            if mag >= 3.0:
                hips_tags.append("tightly cinched narrow waist, dramatic hourglass silhouette, slim midsection")
            else:
                hips_tags.append("slender cinched waist, graceful hourglass curve")
            hips_offset = max(hips_offset, 0.58 + mag * 0.03)
        elif waist_cinch > 0.3:
            hips_tags.append("relaxed wider waistline, straight natural torso fit")
            hips_offset = max(hips_offset, 0.52 + waist_cinch * 0.03)

        # Hips & Butt
        if hips_and_butt < -0.3:
            hips_tags.append("slender straight hips, trim lean silhouette")
            hips_offset = max(hips_offset, 0.55 + abs(hips_and_butt) * 0.03)
        elif hips_and_butt > 0.3:
            if hips_and_butt >= 3.5:
                hips_tags.append("curvaceous wide feminine hips, prominent round shapely glutes, hourglass proportions, fitted fabric tension")
            elif hips_and_butt >= 1.8:
                hips_tags.append("shapely feminine hips, full curvy rear silhouette, flattering clothing drape")
            else:
                hips_tags.append("gently curvy hips, natural feminine lower body contours")
            hips_offset = max(hips_offset, 0.60 + hips_and_butt * 0.03)

        # Thighs
        if thigh_thickness < -0.3:
            hips_tags.append("slender lean legs, slim thighs")
            hips_offset = max(hips_offset, 0.55 + abs(thigh_thickness) * 0.03)
        elif thigh_thickness > 0.3:
            if thigh_thickness >= 3.0:
                hips_tags.append("thick athletic muscular thighs, powerful shapely legs, tight clothing stretch")
            else:
                hips_tags.append("shapely full thighs, athletic toned legs")
            hips_offset = max(hips_offset, 0.58 + thigh_thickness * 0.03)

        hips_prompt = ", ".join(hips_tags) if hips_tags else "lower body silhouette, natural fabric drape, realistic curves"
        hips_denoise = min(0.78, round(hips_offset, 2)) if hips_offset > 0.0 else 0.35

        # ------------------------------------------------------------------
        # 5. Master Composite Prompts
        # ------------------------------------------------------------------
        active_tags = []
        if base_positive.strip():
            active_tags.append(base_positive.strip())

        for p in (face_tags + eye_hair_tags + chest_tags + hips_tags):
            if p not in active_tags:
                active_tags.append(p)

        active_tags.append("masterpiece, 8k resolution, sharp focus, natural skin texture")
        master_positive = ", ".join(active_tags)

        neg_base = base_negative.strip() if base_negative.strip() else (
            "blurry, plastic skin, bad anatomy, deformed proportions, extra limbs, "
            "mutated hands, disfigured, cartoon, 3d render, low quality"
        )
        master_negative = neg_base

        return (
            face_prompt, face_denoise,
            eyes_prompt, eyes_denoise,
            chest_prompt, chest_denoise,
            hips_prompt, hips_denoise,
            master_positive, master_negative
        )
