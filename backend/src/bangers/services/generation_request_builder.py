from __future__ import annotations

from typing import Any

from bangers.backends.ace_step_backend import (
    ACE_STEP_SUPPORTED_AUDIO_FORMATS,
    ACE_STEP_SUPPORTED_TASK_TYPES,
)
from bangers.config import settings


def build_text_to_music_params(
    prompt: str,
    *,
    lyrics: str = "",
    instrumental: bool = True,
    vocal_language: str = "unknown",
    duration: float | None = None,
    batch_size: int = 1,
    audio_format: str | None = None,
    extra: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Build a shared ACE-Step text-to-music request for Create/DJ/Radio."""
    # Force English for all music generation regardless of caller input.
    del vocal_language
    return {
        **(extra or {}),
        "task_type": "text2music",
        "caption": prompt,
        "lyrics": lyrics,
        "instrumental": instrumental,
        "vocal_language": "en",
        "duration": duration if duration is not None else settings.DEFAULT_DURATION,
        "batch_size": batch_size,
        "audio_format": audio_format or settings.DEFAULT_AUDIO_FORMAT,
    }


def normalize_generation_params(params: dict[str, Any]) -> dict[str, Any]:
    """Coerce a generation request to ACE-Step limits."""
    normalized = dict(params)
    normalized["vocal_language"] = "en"

    task_type = normalized.get("task_type", "text2music") or "text2music"
    if task_type not in ACE_STEP_SUPPORTED_TASK_TYPES:
        raise ValueError(f"ACE-Step does not support task_type '{task_type}'")
    normalized["task_type"] = task_type

    audio_format = normalized.get("audio_format") or settings.DEFAULT_AUDIO_FORMAT
    if audio_format not in ACE_STEP_SUPPORTED_AUDIO_FORMATS:
        audio_format = ACE_STEP_SUPPORTED_AUDIO_FORMATS[0]
    normalized["audio_format"] = audio_format

    return normalized
