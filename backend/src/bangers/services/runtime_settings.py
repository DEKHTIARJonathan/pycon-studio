from bangers.config import (
    DEFAULT_KEEP_ACTIVE_MODELS_RESIDENT,
    DEFAULT_LYRICS_GUARDRAILS_ENABLED,
    DEFAULT_PARALLEL_PIPELINE_ENABLED,
)


def parse_bool(value: object, default: bool = False) -> bool:
    if value is None:
        return default
    if isinstance(value, bool):
        return value
    return str(value).strip().lower() in {"1", "true", "yes", "on"}


async def get_bool_setting(key: str, default: bool = False) -> bool:
    try:
        from bangers.db.connection import get_db

        db = await get_db()
        cursor = await db.execute("SELECT value FROM settings WHERE key = ?", (key,))
        row = await cursor.fetchone()
        return parse_bool(row["value"] if row else None, default)
    except Exception:
        return default


async def keep_active_models_resident() -> bool:
    return await get_bool_setting(
        "keep_active_models_resident",
        DEFAULT_KEEP_ACTIVE_MODELS_RESIDENT,
    )


async def parallel_pipeline_enabled() -> bool:
    return await get_bool_setting(
        "parallel_pipeline_enabled",
        DEFAULT_PARALLEL_PIPELINE_ENABLED,
    )


async def lyrics_guardrails_enabled() -> bool:
    return await get_bool_setting(
        "lyrics_guardrails_enabled",
        DEFAULT_LYRICS_GUARDRAILS_ENABLED,
    )
