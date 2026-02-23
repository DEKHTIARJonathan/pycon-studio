import uuid
import aiosqlite
from pathlib import Path

from bangers.config import settings
from bangers.db.schema import SCHEMA_SQL, DEFAULT_SETTINGS


_db: aiosqlite.Connection | None = None
_instance_id: str = ""


def get_instance_id() -> str:
    """Return the current DB's instance_id (cached after init_db)."""
    return _instance_id


async def get_db() -> aiosqlite.Connection:
    global _db
    if _db is None:
        raise RuntimeError("Database not initialized. Call init_db() first.")
    return _db


async def init_db() -> None:
    global _db
    settings.ensure_dirs()
    _db = await aiosqlite.connect(str(settings.DB_PATH))
    _db.row_factory = aiosqlite.Row
    await _db.execute("PRAGMA journal_mode=WAL")
    await _db.execute("PRAGMA foreign_keys=ON")
    await _db.execute("PRAGMA synchronous=NORMAL")
    await _db.execute("PRAGMA cache_size=-32000")
    await _db.execute("PRAGMA temp_store=MEMORY")
    await _db.execute("PRAGMA mmap_size=268435456")
    await _db.execute("PRAGMA busy_timeout=5000")
    await _db.executescript(SCHEMA_SQL)

    # Seed default settings. Environment/profile defaults are folded in for
    # new databases; startup can still force selected keys over existing DB
    # values through Settings.startup_setting_overrides().
    default_settings = {**DEFAULT_SETTINGS, **settings.db_default_overrides()}
    for key, value in default_settings.items():
        await _db.execute(
            "INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)",
            (key, value),
        )

    # Ensure this database has an instance_id. The frontend uses it to detect
    # a wiped/recreated DB so it can clear stale persisted state (queued
    # song IDs, current track, etc.) that would otherwise 404.
    await _db.execute(
        "INSERT OR IGNORE INTO settings (key, value) VALUES ('instance_id', ?)",
        (str(uuid.uuid4()),),
    )
    await _db.commit()

    # Cache the instance_id so the health endpoint can serve it without a
    # DB roundtrip on every poll.
    global _instance_id
    cursor = await _db.execute(
        "SELECT value FROM settings WHERE key = 'instance_id'"
    )
    row = await cursor.fetchone()
    _instance_id = row["value"] if row else ""


async def close_db() -> None:
    global _db, _instance_id
    if _db is not None:
        await _db.close()
        _db = None
    _instance_id = ""
