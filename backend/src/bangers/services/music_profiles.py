from __future__ import annotations

import re
from dataclasses import dataclass

from bangers.db.schema import RADIO_PRESETS


@dataclass(frozen=True)
class GenreProfile:
    name: str
    description: str
    genre: str
    mood: str
    instrumental: bool
    bpm_min: int | None
    bpm_max: int | None
    caption_template: str
    aliases: tuple[str, ...]
    avoid: str = ""


PROFILE_ALIASES: dict[str, tuple[str, ...]] = {
    "Lo-Fi Chill": ("lo fi", "lo-fi", "lofi", "chillhop", "study beats"),
    "Jazz Club": ("jazz", "cool jazz", "bebop", "lounge jazz"),
    "EDM": (
        "edm",
        "electronic dance music",
        "dance music",
        "progressive house",
        "big room",
        "melodic house",
        "festival house",
    ),
    "Techno": ("techno", "industrial techno", "warehouse techno", "acid techno"),
    "Drum & Bass": ("drum and bass", "drum & bass", "dnb", "drum n bass", "neurofunk"),
    "Reggae": ("reggae", "roots reggae", "dub", "dub reggae"),
    "Blues": ("blues", "electric blues", "chicago blues", "blues rock"),
    "Country": ("country", "countries", "americana", "nashville", "southern country"),
    "Folk": ("folk", "acoustic folk", "indie folk"),
    "Metal": ("metal", "heavy metal", "modern metal", "melodic metal"),
    "Swing": ("swing", "big band", "big-band", "vintage swing"),
    "Rock 'n' Roll": (
        "rock",
        "rock and roll",
        "rock n roll",
        "rock 'n' roll",
        "rockabilly",
        "classic rock",
        "hard rock",
    ),
    "Ambient": ("ambient", "drone", "atmospheric ambient", "soundscape"),
    "Pop": ("pop", "dance pop", "commercial pop", "modern pop"),
    "Rap": ("rap", "hip hop", "hip-hop", "trap", "modern hip hop"),
    "R&B": ("r&b", "rnb", "rhythm and blues", "neo soul", "alternative r&b"),
}


PROFILE_AVOID: dict[str, str] = {
    "EDM": (
        "Avoid vague festival hype, muddy kick/bass clashes, rock band instrumentation, "
        "and overstuffed drops."
    ),
    "Techno": (
        "Avoid pop vocals, busy chord progressions, acoustic band cues, and bright EDM drops."
    ),
    "Drum & Bass": (
        "Avoid half-time hip-hop grooves, weak sub bass, slow tempos, and generic EDM drops."
    ),
    "Metal": (
        "Avoid orchestral-only cues, thin guitars, soft pop drums, and blurred wall-of-noise prompts."
    ),
    "Rock 'n' Roll": (
        "Avoid modern EDM synthesis, metal double-kick density, and vague arena adjectives."
    ),
    "Rap": (
        "Avoid sung pop choruses dominating the track, weak drums, and over-complex harmonic pads."
    ),
    "Pop": (
        "Avoid experimental club minimalism, noisy distortion, and unfocused genre blending."
    ),
}


PROFILE_REWRITES: dict[str, dict[str, object]] = {
    "EDM": {
        "description": (
            "Focused melodic progressive house with a clean four-on-the-floor kick, "
            "sidechained bass, bright plucked synth arpeggios, controlled supersaw chords, "
            "short risers, a clear eight-bar build, one focused drop, tight clap/snare layers, "
            "and polished club mix clarity."
        ),
        "genre": "melodic progressive house, electro house",
        "mood": "uplifting, driving, bright, danceable, controlled, energetic",
        "caption_template": (
            "A clean melodic progressive house track with a punchy four-on-the-floor kick, "
            "sidechained bass groove, bright plucked synth arpeggios, focused supersaw chords, "
            "tight claps, a clear build into one controlled drop, and polished club mix clarity"
        ),
        "bpm_min": 124,
        "bpm_max": 130,
    },
    "Techno": {
        "description": (
            "Minimal warehouse techno built around a dry kick, low rumble bass, offbeat hats, "
            "muted percussion loops, restrained acid synth movement, filtered noise sweeps, "
            "and hypnotic repetition with gradual modulation."
        ),
        "genre": "minimal warehouse techno, acid techno",
        "mood": "hypnotic, dark, mechanical, restrained, nocturnal, focused",
        "caption_template": (
            "A minimal warehouse techno track with a dry pounding kick, low rumble bass, "
            "offbeat hi-hats, muted industrial percussion, restrained acid synth modulation, "
            "filtered noise sweeps, and hypnotic gradual tension"
        ),
        "bpm_min": 126,
        "bpm_max": 136,
    },
    "Drum & Bass": {
        "description": (
            "Tight liquid drum and bass with fast chopped breakbeats, crisp ghost snares, "
            "deep reese/sub bass, atmospheric pads, concise vocal chops, and clean low-end pressure."
        ),
        "genre": "liquid drum and bass, modern DnB",
        "mood": "fast, flowing, futuristic, atmospheric, energetic, precise",
        "caption_template": (
            "A tight liquid drum and bass track with fast chopped breakbeats, crisp ghost snares, "
            "deep reese bass, sub-heavy low-end pressure, atmospheric pads, concise vocal chops, "
            "and clean forward momentum"
        ),
        "bpm_min": 168,
        "bpm_max": 174,
    },
    "Metal": {
        "description": (
            "Modern melodic metal with one clear down-tuned guitar riff, tight live double-kick drums, "
            "palm-muted verses, a defined chorus hook, controlled distortion, and strong vocal phrasing."
        ),
        "genre": "modern melodic metal, heavy metal",
        "mood": "heavy, intense, focused, dark, powerful, driving",
        "caption_template": (
            "A focused modern melodic metal track with one clear down-tuned guitar riff, "
            "tight live double-kick drums, palm-muted verse rhythm, controlled high-gain distortion, "
            "strong vocal phrasing, and a defined heavy chorus hook"
        ),
        "bpm_min": 128,
        "bpm_max": 168,
    },
    "Rock 'n' Roll": {
        "description": (
            "Classic guitar-driven rock with a simple memorable electric guitar riff, live drum backbeat, "
            "bass guitar groove, verse/chorus structure, tube amp warmth, and a confident lead vocal."
        ),
        "genre": "classic guitar rock, rock and roll",
        "mood": "upbeat, gritty, lively, confident, warm, danceable",
        "caption_template": (
            "A classic guitar-driven rock track with a simple memorable electric guitar riff, "
            "live drum backbeat, bass guitar groove, tube amp warmth, verse-chorus structure, "
            "handclap accents, and a confident lead vocal hook"
        ),
        "bpm_min": 100,
        "bpm_max": 148,
    },
}


def _normalize(text: str) -> str:
    text = text.lower().replace("&", " and ")
    text = re.sub(r"[^a-z0-9]+", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def _int_override(primary: object, fallback: object) -> int | None:
    if isinstance(primary, int):
        return primary
    if isinstance(fallback, int):
        return fallback
    return None


def _profile_from_preset(preset: dict[str, object]) -> GenreProfile:
    name = str(preset["name"])
    rewrite = PROFILE_REWRITES.get(name, {})
    return GenreProfile(
        name=name,
        description=str(rewrite.get("description") or preset.get("description") or ""),
        genre=str(rewrite.get("genre") or preset.get("genre") or ""),
        mood=str(rewrite.get("mood") or preset.get("mood") or ""),
        instrumental=bool(rewrite.get("instrumental", preset.get("instrumental", True))),
        bpm_min=_int_override(rewrite.get("bpm_min"), preset.get("bpm_min")),
        bpm_max=_int_override(rewrite.get("bpm_max"), preset.get("bpm_max")),
        caption_template=str(rewrite.get("caption_template") or preset.get("caption_template") or ""),
        aliases=PROFILE_ALIASES.get(name, (name,)),
        avoid=PROFILE_AVOID.get(name, ""),
    )


GENRE_PROFILES: tuple[GenreProfile, ...] = tuple(
    _profile_from_preset(preset) for preset in RADIO_PRESETS
)


def resolve_genre_profile(*texts: str) -> GenreProfile | None:
    haystack = _normalize(" ".join(t for t in texts if t))
    if not haystack:
        return None

    best: tuple[int, GenreProfile] | None = None
    padded = f" {haystack} "
    for profile in GENRE_PROFILES:
        terms = (profile.name, profile.genre, *profile.aliases)
        for term in terms:
            normalized = _normalize(term)
            if not normalized:
                continue
            matched = f" {normalized} " in padded
            if not matched and " " in normalized:
                matched = all(f" {part} " in padded for part in normalized.split())
            if matched:
                score = len(normalized)
                if best is None or score > best[0]:
                    best = (score, profile)
    return best[1] if best else None


def render_profile_caption(
    profile: GenreProfile | None,
    *,
    prompt: str = "",
    genre: str = "",
    mood: str = "",
    caption_template: str = "",
) -> str:
    active_genre = genre.strip() or (profile.genre if profile else "")
    active_mood = mood.strip() or (profile.mood if profile else "")
    template = caption_template.strip() or (profile.caption_template if profile else "")

    if template:
        caption = template.replace("{genre}", active_genre).replace("{mood}", active_mood)
    elif profile:
        caption = (
            f"A {profile.genre} track with {profile.mood} character, "
            f"using the core instruments, groove, and production traits of {profile.name}."
        )
    elif prompt.strip():
        caption = prompt.strip()
    else:
        caption = "A complete, well-arranged music track with clear instrumentation and coherent structure"

    user_prompt = prompt.strip()
    normalized_prompt = _normalize(user_prompt)
    profile_terms = (profile.aliases if profile else ()) + (
        profile.name if profile else "",
    )
    alias_terms = {_normalize(term) for term in profile_terms}
    if user_prompt and normalized_prompt not in alias_terms and user_prompt.lower() not in caption.lower():
        caption = f"{caption}. User intent: {user_prompt}"

    if profile and profile.avoid:
        caption = f"{caption}. {profile.avoid}"

    return caption[:3800].strip()
