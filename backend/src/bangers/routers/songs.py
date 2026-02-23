import os
import shutil
import uuid
from datetime import datetime, timezone
from pathlib import Path
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import FileResponse
from loguru import logger

from bangers.config import settings
from bangers.db.connection import get_db
from bangers.models.common import (
    BulkDeleteRequest,
    BulkUpdateRequest,
    SaveToLibraryRequest,
    SongListResponse,
    SongResponse,
    SongUpdate,
)

router = APIRouter(prefix="/songs", tags=["songs"])


async def _probe_duration(file_path: Path) -> float | None:
    """Read audio duration in seconds via TinyTag (pure Python, cross-platform)."""
    try:
        from tinytag import TinyTag
        tag = TinyTag.get(str(file_path))
        if tag.duration is not None:
            return round(tag.duration, 2)
    except Exception as e:
        logger.debug(f"TinyTag duration read failed: {e}")
    return None


@router.get("", response_model=SongListResponse)
async def list_songs(
    search: str = Query(default="", description="Search in title, caption, lyrics, tags"),
    sort: str = Query(default="created_at", description="Sort field"),
    order: str = Query(default="desc", description="Sort order: asc or desc"),
    favorite: bool | None = Query(default=None),
    vocal_language: str = Query(default="", description="Filter by vocal language"),
    file_format: str = Query(default="", description="Filter by file format"),
    instrumental: bool | None = Query(default=None, description="Filter by instrumental"),
    timesignature: str = Query(default="", description="Filter by time signature"),
    tag: str = Query(default="", description="Filter by tag (e.g. 'radio')"),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
) -> SongListResponse:
    db = await get_db()
    conditions = []
    params: list = []

    if search:
        conditions.append(
            "(title LIKE ? OR caption LIKE ? OR lyrics LIKE ? OR tags LIKE ?)"
        )
        like = f"%{search}%"
        params.extend([like, like, like, like])

    if favorite is not None:
        conditions.append("is_favorite = ?")
        params.append(1 if favorite else 0)

    if vocal_language:
        conditions.append("vocal_language = ?")
        params.append(vocal_language)

    if file_format:
        conditions.append("file_format = ?")
        params.append(file_format)

    if instrumental is not None:
        conditions.append("instrumental = ?")
        params.append(1 if instrumental else 0)

    if timesignature:
        conditions.append("timesignature = ?")
        params.append(timesignature)

    if tag:
        conditions.append("tags LIKE ?")
        params.append(f"%{tag}%")

    where = f"WHERE {' AND '.join(conditions)}" if conditions else ""
    order_dir = "ASC" if order.lower() == "asc" else "DESC"
    allowed_sorts = {"created_at", "updated_at", "title", "rating", "duration_seconds", "bpm"}
    sort_field = sort if sort in allowed_sorts else "created_at"

    count_cursor = await db.execute(
        f"SELECT COUNT(*) as cnt FROM songs {where}", params
    )
    count_row = await count_cursor.fetchone()
    total = count_row["cnt"] if count_row else 0

    query = f"SELECT * FROM songs {where} ORDER BY {sort_field} {order_dir} LIMIT ? OFFSET ?"
    items_params = [*params, limit, offset]

    cursor = await db.execute(query, items_params)
    rows = await cursor.fetchall()
    return SongListResponse(
        items=[_row_to_song(row) for row in rows],
        total=total,
    )


@router.post("", response_model=SongResponse)
async def save_to_library(request: SaveToLibraryRequest) -> SongResponse:
    db = await get_db()
    song_id = str(uuid.uuid4())

    # Copy audio file to library storage
    src_path = Path(request.file_path)
    if not src_path.exists():
        raise HTTPException(status_code=404, detail="Source audio file not found")

    dest_filename = f"{song_id}.{request.file_format}"
    dest_path = settings.AUDIO_DIR / dest_filename

    try:
        shutil.copy2(str(src_path), str(dest_path))
    except OSError as e:
        raise HTTPException(status_code=500, detail=f"Failed to copy audio file: {e}")

    file_size = dest_path.stat().st_size

    # Auto-detect duration from audio file if not provided
    duration = request.duration_seconds
    if duration is None:
        duration = await _probe_duration(dest_path)

    now = datetime.now(timezone.utc).isoformat()

    await db.execute(
        """INSERT INTO songs (
            id, title, file_path, file_format, duration_seconds, sample_rate,
            file_size_bytes, caption, lyrics, bpm, keyscale, timesignature,
            vocal_language, instrumental, generation_history_id, variation_index,
            parent_song_id, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            song_id, request.title, dest_filename, request.file_format,
            duration, request.sample_rate, file_size,
            request.caption, request.lyrics, request.bpm, request.keyscale,
            request.timesignature, request.vocal_language,
            1 if request.instrumental else 0,
            request.generation_history_id, request.variation_index,
            request.parent_song_id, now, now,
        ),
    )
    await db.commit()

    return SongResponse(
        id=song_id,
        title=request.title,
        file_path=dest_filename,
        file_format=request.file_format,
        duration_seconds=duration,
        sample_rate=request.sample_rate,
        file_size_bytes=file_size,
        caption=request.caption,
        lyrics=request.lyrics,
        bpm=request.bpm,
        keyscale=request.keyscale,
        timesignature=request.timesignature,
        vocal_language=request.vocal_language,
        instrumental=request.instrumental,
        is_favorite=False,
        rating=0,
        tags="",
        notes="",
        parent_song_id=request.parent_song_id,
        generation_history_id=request.generation_history_id,
        variation_index=request.variation_index,
        created_at=now,
        updated_at=now,
    )


@router.post("/bulk-delete")
async def bulk_delete_songs(body: BulkDeleteRequest) -> dict:
    db = await get_db()
    if not body.song_ids:
        return {"deleted": 0}

    placeholders = ",".join("?" for _ in body.song_ids)
    cursor = await db.execute(
        f"SELECT id, file_path FROM songs WHERE id IN ({placeholders})",
        body.song_ids,
    )
    rows = await cursor.fetchall()

    for row in rows:
        file_path = settings.AUDIO_DIR / row["file_path"]
        if file_path.exists():
            file_path.unlink()

    await db.execute(
        f"DELETE FROM songs WHERE id IN ({placeholders})",
        body.song_ids,
    )
    await db.commit()

    return {"deleted": len(rows)}


@router.patch("/bulk")
async def bulk_update_songs(body: BulkUpdateRequest) -> dict:
    db = await get_db()

    updates = body.updates.model_dump(exclude_unset=True)
    if not updates or not body.song_ids:
        return {"updated": 0}

    set_clause = ", ".join(f"{k} = ?" for k in updates)
    values = list(updates.values())
    placeholders = ",".join("?" for _ in body.song_ids)

    result = await db.execute(
        f"UPDATE songs SET {set_clause}, updated_at = datetime('now') WHERE id IN ({placeholders})",
        values + body.song_ids,
    )
    await db.commit()

    return {"updated": result.rowcount}


@router.get("/{song_id}", response_model=SongResponse)
async def get_song(song_id: str) -> SongResponse:
    db = await get_db()
    cursor = await db.execute("SELECT * FROM songs WHERE id = ?", (song_id,))
    row = await cursor.fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Song not found")
    return _row_to_song(row)


@router.patch("/{song_id}", response_model=SongResponse)
async def update_song(song_id: str, body: SongUpdate) -> SongResponse:
    db = await get_db()

    updates = body.model_dump(exclude_unset=True)
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")

    # Convert bool to int for SQLite
    if "is_favorite" in updates:
        updates["is_favorite"] = 1 if updates["is_favorite"] else 0

    set_clause = ", ".join(f"{k} = ?" for k in updates)
    values = list(updates.values())
    values.append(song_id)

    await db.execute(
        f"UPDATE songs SET {set_clause}, updated_at = datetime('now') WHERE id = ?",
        values,
    )
    await db.commit()

    return await get_song(song_id)


@router.delete("/{song_id}")
async def delete_song(song_id: str) -> dict:
    db = await get_db()
    cursor = await db.execute("SELECT file_path FROM songs WHERE id = ?", (song_id,))
    row = await cursor.fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Song not found")

    # Delete audio file
    audio_path = settings.AUDIO_DIR / row["file_path"]
    if audio_path.exists():
        audio_path.unlink()

    await db.execute("DELETE FROM songs WHERE id = ?", (song_id,))
    await db.commit()

    return {"deleted": True}


@router.get("/{song_id}/audio")
async def stream_audio(
    song_id: str,
    download: bool = Query(default=False, description="Trigger browser download"),
) -> FileResponse:
    db = await get_db()
    cursor = await db.execute("SELECT title, file_path, file_format FROM songs WHERE id = ?", (song_id,))
    row = await cursor.fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Song not found")

    audio_path = settings.AUDIO_DIR / row["file_path"]
    if not audio_path.exists():
        raise HTTPException(status_code=404, detail="Audio file not found")

    media_types = {
        "flac": "audio/flac",
        "mp3": "audio/mpeg",
        "wav": "audio/wav",
        "wav32": "audio/wav",
        "opus": "audio/opus",
        "aac": "audio/aac",
    }
    media_type = media_types.get(row["file_format"], "application/octet-stream")

    if download:
        filename = f"{row['title']}.{row['file_format']}"
        return FileResponse(
            str(audio_path),
            media_type=media_type,
            filename=filename,
        )

    return FileResponse(str(audio_path), media_type=media_type)


@router.get("/{song_id}/source-path")
async def get_source_path(song_id: str) -> dict:
    db = await get_db()
    cursor = await db.execute("SELECT file_path FROM songs WHERE id = ?", (song_id,))
    row = await cursor.fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Song not found")
    return {"file_path": str(settings.AUDIO_DIR / row["file_path"])}


@router.get("/{song_id}/variations")
async def get_variations(song_id: str) -> dict:
    db = await get_db()

    cursor = await db.execute("SELECT * FROM songs WHERE id = ?", (song_id,))
    row = await cursor.fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Song not found")
    song = _row_to_song(row)

    cursor = await db.execute(
        """WITH RECURSIVE ancestors AS (
            SELECT * FROM songs WHERE id = ?
            UNION ALL
            SELECT s.* FROM songs s
            JOIN ancestors a ON s.id = a.parent_song_id
        )
        SELECT * FROM ancestors""",
        (song_id,),
    )
    ancestor_rows = await cursor.fetchall()
    ancestors = [_row_to_song(r) for r in ancestor_rows if r["id"] != song_id]

    cursor = await db.execute(
        "SELECT * FROM songs WHERE parent_song_id = ? ORDER BY variation_index",
        (song_id,),
    )
    child_rows = await cursor.fetchall()
    children = [_row_to_song(r) for r in child_rows]

    return {"song": song, "ancestors": ancestors, "children": children}


def _row_to_song(row) -> SongResponse:
    return SongResponse(
        id=row["id"],
        title=row["title"],
        file_path=row["file_path"],
        file_format=row["file_format"],
        duration_seconds=row["duration_seconds"],
        sample_rate=row["sample_rate"] or 48000,
        file_size_bytes=row["file_size_bytes"],
        caption=row["caption"] or "",
        lyrics=row["lyrics"] or "",
        bpm=row["bpm"],
        keyscale=row["keyscale"] or "",
        timesignature=row["timesignature"] or "",
        vocal_language=row["vocal_language"] or "unknown",
        instrumental=bool(row["instrumental"]),
        is_favorite=bool(row["is_favorite"]),
        rating=row["rating"] or 0,
        tags=row["tags"] or "",
        notes=row["notes"] or "",
        parent_song_id=row["parent_song_id"],
        generation_history_id=row["generation_history_id"],
        variation_index=row["variation_index"] or 0,
        created_at=row["created_at"] or "",
        updated_at=row["updated_at"] or "",
    )
