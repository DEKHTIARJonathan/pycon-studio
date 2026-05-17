from __future__ import annotations

import random
import re
from typing import Any

from loguru import logger

from bangers.services import chat_llm
from bangers.services.lyrics_pipeline import LyricsRejectedError, generate_song_spec
from bangers.services.music_profiles import (
    GenreProfile,
    render_profile_caption,
    resolve_genre_profile,
)


QUALITY_CAPTION_SYSTEM_PROMPT = (
    "You are a music producer preparing prompts for an AI music generator. "
    "Write one concise but specific caption. Name instrumentation, groove, texture, "
    "arrangement, and sonic character. Output only the caption text."
)


def _clean_caption(raw: str) -> str:
    cleaned = raw.strip()
    cleaned = re.sub(r"^```(?:text)?\s*|\s*```$", "", cleaned, flags=re.IGNORECASE)
    cleaned = cleaned.strip().strip('"').strip("'").strip()
    return cleaned[:3800]


def _choose_bpm(
    *,
    bpm: int | None,
    bpm_min: int | None,
    bpm_max: int | None,
    profile: GenreProfile | None,
) -> int | None:
    if bpm is not None:
        return bpm
    low = bpm_min if bpm_min is not None else (profile.bpm_min if profile else None)
    high = bpm_max if bpm_max is not None else (profile.bpm_max if profile else None)
    if low is not None and high is not None:
        return random.randint(min(low, high), max(low, high))
    return low


def _fallback_lyrics(
    *,
    profile: GenreProfile | None,
    genre: str,
    mood: str,
    caption: str,
) -> str:
    theme = genre or (profile.genre if profile else "") or "the song"
    feeling = mood or (profile.mood.split(",")[0] if profile and profile.mood else "") or "the night"
    image = (caption or theme).replace("\n", " ")[:48]
    return (
        "[verse]\n"
        f"We move through {feeling}\n"
        f"Following the sound of {theme}\n"
        "Every shadow starts to move\n"
        "Every heartbeat finds the groove\n\n"
        "[chorus]\n"
        f"Sing it out, {theme} in the air\n"
        "Lift the moment everywhere\n"
        "Hold the light and carry on\n"
        f"Turn {image} into song\n\n"
        "[bridge]\n"
        "Let the rhythm rise again\n"
        "Let the story never end"
    )


async def _generate_caption_with_chat(
    *,
    caption: str,
    profile: GenreProfile | None,
    genre: str,
    mood: str,
    system_prompt: str | None,
    allow_holders: frozenset[str] | None,
    temperature: float,
) -> str | None:
    runtime, model_name = await chat_llm.get_configured_chat_runtime()
    if runtime is None:
        logger.info("Music spec caption: no Chat LLM available; using template")
        return None

    profile_block = ""
    if profile is not None:
        profile_block = (
            f"\nResolved genre profile: {profile.name}\n"
            f"Genre anchors: {profile.genre}\n"
            f"Mood anchors: {profile.mood}\n"
            f"Reference: {profile.description}\n"
            f"Avoid: {profile.avoid}"
        )

    messages = [
        {"role": "system", "content": system_prompt or QUALITY_CAPTION_SYSTEM_PROMPT},
        {
            "role": "user",
            "content": (
                "Rewrite this into a complete music generation caption.\n"
                f"Current caption: {caption}\n"
                f"Genre: {genre}\n"
                f"Mood: {mood}"
                f"{profile_block}"
            ),
        },
    ]
    raw = await runtime.chat(
        messages,
        model=model_name,
        max_tokens=512,
        temperature=temperature,
        allow_holders=allow_holders,
    )
    cleaned = _clean_caption(raw)
    return cleaned or None


async def build_music_spec(
    *,
    prompt: str,
    instrumental: bool,
    lyrics: str = "",
    genre: str = "",
    mood: str = "",
    caption_template: str = "",
    bpm: int | None = None,
    bpm_min: int | None = None,
    bpm_max: int | None = None,
    keyscale: str = "",
    timesignature: str = "",
    duration: float | None = None,
    source: str = "create",
    system_prompt: str | None = None,
    allow_holders: frozenset[str] | None = None,
    temperature: float = 0.85,
) -> dict[str, Any]:
    """Build one normalized music-generation spec for Create, Radio, and DJ.

    The function prefers Chat LLM enrichment when available, but always returns
    a usable template/profile fallback so quality mode is not gated on a loaded
    Chat LLM.
    """
    profile = resolve_genre_profile(genre, prompt, caption_template, mood)
    caption = render_profile_caption(
        profile,
        prompt=prompt,
        genre=genre,
        mood=mood,
        caption_template=caption_template,
    )
    selected_bpm = _choose_bpm(
        bpm=bpm,
        bpm_min=bpm_min,
        bpm_max=bpm_max,
        profile=profile,
    )
    spec_source = "profile-template" if profile else "prompt-template"

    if lyrics.strip():
        spec_source = "provided-lyrics"
        return {
            "caption": caption,
            "lyrics": lyrics.strip(),
            "bpm": selected_bpm,
            "duration": duration,
            "keyscale": keyscale,
            "language": "en",
            "timesignature": timesignature,
            "instrumental": instrumental,
            "quality_profile": profile.name if profile else "",
            "spec_source": spec_source,
            "source_prompt": prompt,
            "success": True,
        }

    if instrumental:
        try:
            llm_caption = await _generate_caption_with_chat(
                caption=caption,
                profile=profile,
                genre=genre,
                mood=mood,
                system_prompt=system_prompt,
                allow_holders=allow_holders,
                temperature=temperature,
            )
            if llm_caption:
                caption = llm_caption
                spec_source = "llm-caption"
        except Exception as exc:
            logger.info(f"Music spec caption fallback used: {exc}")

        return {
            "caption": caption,
            "lyrics": "",
            "bpm": selected_bpm,
            "duration": duration,
            "keyscale": keyscale,
            "language": "en",
            "timesignature": timesignature,
            "instrumental": True,
            "quality_profile": profile.name if profile else "",
            "spec_source": spec_source,
            "source_prompt": prompt,
            "success": True,
        }

    try:
        spec_prompt = caption
        if profile is not None:
            spec_prompt = (
                f"{caption}\n\nGenre profile: {profile.name}\n"
                f"Use these anchors: {profile.description}\n"
                f"Music generator caption should stay close to: {profile.caption_template}\n"
                f"{profile.avoid}"
            )
        if system_prompt:
            spec_prompt = f"{spec_prompt}\n\nAdditional caption guidance:\n{system_prompt}"
        spec = await generate_song_spec(
            spec_prompt,
            instrumental=False,
            user_metadata={
                "bpm": selected_bpm,
                "keyscale": keyscale,
                "timesignature": timesignature,
                "duration": duration,
                "genre_profile": profile.name if profile else "",
            },
            allow_holders=allow_holders,
        )
        generated_caption = str(spec.get("caption") or "").strip()
        generated_lyrics = str(spec.get("lyrics") or "").strip()
        if generated_caption:
            caption = generated_caption
        if generated_lyrics:
            lyrics = generated_lyrics
            spec_source = "llm-song-spec"
        if selected_bpm is None and isinstance(spec.get("bpm"), int):
            selected_bpm = spec["bpm"]
        if not keyscale and spec.get("keyscale"):
            keyscale = str(spec["keyscale"])
        if not timesignature and spec.get("timesignature"):
            timesignature = str(spec["timesignature"])
    except LyricsRejectedError:
        raise
    except Exception as exc:
        logger.info(f"Music spec vocal fallback used: {exc}")

    if not lyrics.strip():
        lyrics = _fallback_lyrics(
            profile=profile,
            genre=genre,
            mood=mood,
            caption=caption,
        )
        spec_source = f"{spec_source}+fallback-lyrics"

    return {
        "caption": caption,
        "lyrics": lyrics.strip(),
        "bpm": selected_bpm,
        "duration": duration,
        "keyscale": keyscale,
        "language": "en",
        "timesignature": timesignature,
        "instrumental": False,
        "quality_profile": profile.name if profile else "",
        "spec_source": spec_source,
        "source_prompt": prompt,
        "success": True,
    }
