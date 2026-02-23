import json

from fastapi import APIRouter, HTTPException, Query

from bangers.db.connection import get_db
from bangers.models.generation import (
    GenerationHistoryResponse,
    GenerationHistoryListResponse,
)

router = APIRouter(prefix="/history", tags=["history"])


@router.get("", response_model=GenerationHistoryListResponse)
async def list_history(
    search: str = Query(default="", description="Search in params JSON text"),
    status: str = Query(default="", description="Filter by status"),
    task_type: str = Query(default="", description="Filter by task type"),
    sort: str = Query(default="created_at", description="Sort field"),
    order: str = Query(default="desc", description="Sort order: asc or desc"),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
) -> GenerationHistoryListResponse:
    db = await get_db()
    conditions: list[str] = []
    params: list = []

    if search:
        conditions.append("gh.params_json LIKE ?")
        params.append(f"%{search}%")

    if status:
        conditions.append("gh.status = ?")
        params.append(status)

    if task_type:
        conditions.append("gh.task_type = ?")
        params.append(task_type)

    where = f"WHERE {' AND '.join(conditions)}" if conditions else ""
    order_dir = "ASC" if order.lower() == "asc" else "DESC"
    allowed_sorts = {"created_at", "duration_ms", "audio_count"}
    sort_field = sort if sort in allowed_sorts else "created_at"

    # Total count
    count_cursor = await db.execute(
        f"SELECT COUNT(*) as cnt FROM generation_history gh {where}",
        params,
    )
    count_row = await count_cursor.fetchone()
    total = count_row["cnt"] if count_row else 0

    query = f"""
        SELECT gh.*,
               COALESCE(sc.saved_song_count, 0) AS saved_song_count
        FROM generation_history gh
        LEFT JOIN (
            SELECT generation_history_id, COUNT(*) AS saved_song_count
            FROM songs
            WHERE generation_history_id IS NOT NULL
            GROUP BY generation_history_id
        ) sc ON sc.generation_history_id = gh.id
        {where}
        ORDER BY gh.{sort_field} {order_dir}
        LIMIT ? OFFSET ?
    """
    items_params = [*params, limit, offset]
    cursor = await db.execute(query, items_params)
    rows = await cursor.fetchall()

    return GenerationHistoryListResponse(
        items=[_row_to_history(row) for row in rows],
        total=total,
    )


@router.get("/{history_id}", response_model=GenerationHistoryResponse)
async def get_history_entry(history_id: str) -> GenerationHistoryResponse:
    db = await get_db()
    cursor = await db.execute(
        """SELECT gh.*,
                  COALESCE(sc.saved_song_count, 0) AS saved_song_count
           FROM generation_history gh
           LEFT JOIN (
               SELECT generation_history_id, COUNT(*) AS saved_song_count
               FROM songs
               WHERE generation_history_id IS NOT NULL
               GROUP BY generation_history_id
           ) sc ON sc.generation_history_id = gh.id
           WHERE gh.id = ?""",
        (history_id,),
    )
    row = await cursor.fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="History entry not found")
    return _row_to_history(row)


@router.patch("/{history_id}")
async def update_history_entry(history_id: str, body: dict) -> GenerationHistoryResponse:
    db = await get_db()
    cursor = await db.execute(
        "SELECT id FROM generation_history WHERE id = ?",
        (history_id,),
    )
    row = await cursor.fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="History entry not found")

    if "title" in body:
        await db.execute(
            "UPDATE generation_history SET title = ? WHERE id = ?",
            (body["title"], history_id),
        )
        await db.commit()

    return await get_history_entry(history_id)


@router.delete("/{history_id}")
async def delete_history_entry(history_id: str) -> dict:
    db = await get_db()
    cursor = await db.execute(
        "SELECT id FROM generation_history WHERE id = ?",
        (history_id,),
    )
    row = await cursor.fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="History entry not found")

    # Songs FK has ON DELETE SET NULL, so just delete the history row
    await db.execute("DELETE FROM generation_history WHERE id = ?", (history_id,))
    await db.commit()

    return {"deleted": True}


def _row_to_history(row) -> GenerationHistoryResponse:
    # Parse params_json
    try:
        params = json.loads(row["params_json"] or "{}")
    except (json.JSONDecodeError, TypeError):
        params = {}

    # Parse result_json — schema defaults to '{}', but completed entries have a list
    try:
        raw_results = json.loads(row["result_json"] or "{}")
    except (json.JSONDecodeError, TypeError):
        raw_results = []

    # If parsed result is a dict (default empty), treat as empty list
    results = raw_results if isinstance(raw_results, list) else []

    return GenerationHistoryResponse(
        id=row["id"],
        task_type=row["task_type"] or "text2music",
        status=row["status"] or "pending",
        title=row["title"] if "title" in row.keys() else None,
        params=params,
        results=results,
        audio_count=row["audio_count"] or 0,
        error_message=row["error_message"],
        started_at=row["started_at"],
        completed_at=row["completed_at"],
        duration_ms=row["duration_ms"],
        created_at=row["created_at"] or "",
        saved_song_count=row["saved_song_count"] if "saved_song_count" in row.keys() else 0,
    )
