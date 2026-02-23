from __future__ import annotations

from loguru import logger

from bangers.config import settings
from bangers.db.connection import get_db


MIN_GENERATION_DURATION = 10.0
MAX_GENERATION_DURATION = 600.0


def coerce_duration(
    value: object,
    *,
    fallback: float | None = None,
    max_duration: float = MAX_GENERATION_DURATION,
) -> float:
    """Coerce a duration-like value into the supported generation range."""
    fallback_value = settings.DEFAULT_DURATION if fallback is None else fallback
    try:
        duration = float(value)
    except (TypeError, ValueError):
        duration = fallback_value

    if duration <= 0:
        duration = fallback_value

    return max(MIN_GENERATION_DURATION, min(duration, max_duration))


async def get_default_duration(
    *,
    max_duration: float = MAX_GENERATION_DURATION,
) -> float:
    """Read the app-wide default song length from settings with env fallback."""
    value: object = settings.DEFAULT_DURATION
    try:
        db = await get_db()
        cursor = await db.execute(
            "SELECT value FROM settings WHERE key = 'default_duration'"
        )
        row = await cursor.fetchone()
        if row is not None:
            value = row["value"]
    except Exception as exc:
        logger.debug(f"Could not load default_duration from settings: {exc}")

    return coerce_duration(value, max_duration=max_duration)
