"""Tests for Phase 9 features: schema indexes, filter params, bulk ops, variations, history JOIN."""

import json
import uuid

import pytest


async def _create_song(client, tmp_path, **overrides):
    """Helper: create a song via POST, returns the response JSON."""
    audio = tmp_path / "data" / "uploads" / f"{uuid.uuid4()}.flac"
    audio.parent.mkdir(parents=True, exist_ok=True)
    audio.write_bytes(b"\x00" * 128)

    payload = {
        "title": overrides.get("title", "Test Song"),
        "file_path": str(audio),
        "file_format": "flac",
        "duration_seconds": overrides.get("duration_seconds", 60.0),
        "caption": overrides.get("caption", "test caption"),
        "lyrics": overrides.get("lyrics", ""),
        "bpm": overrides.get("bpm", 120),
        "keyscale": overrides.get("keyscale", "C major"),
        "timesignature": overrides.get("timesignature", "4/4"),
        "vocal_language": overrides.get("vocal_language", "en"),
        "instrumental": overrides.get("instrumental", False),
        "parent_song_id": overrides.get("parent_song_id", None),
        "generation_history_id": overrides.get("generation_history_id", None),
        "variation_index": overrides.get("variation_index", 0),
    }
    resp = await client.post("/api/songs", json=payload)
    assert resp.status_code == 200
    return resp.json()


async def _create_history_entry(client, tmp_path):
    """Insert a history row directly via DB, return its id."""
    from bangers.db.connection import get_db

    db = await get_db()
    entry_id = str(uuid.uuid4())
    await db.execute(
        """INSERT INTO generation_history (id, task_type, status, params_json, result_json, audio_count)
           VALUES (?, ?, ?, ?, ?, ?)""",
        (entry_id, "text2music", "completed", '{"caption":"test"}', "[]", 2),
    )
    await db.commit()
    return entry_id


# ---------- 9A.1: Schema Indexes ----------


@pytest.mark.asyncio
async def test_indexes_exist_after_init(client):
    """Verify new indexes from Phase 9A.1 exist."""
    from bangers.db.connection import get_db

    db = await get_db()
    cursor = await db.execute(
        "SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_%'"
    )
    rows = await cursor.fetchall()
    index_names = {row["name"] for row in rows}

    expected = {
        "idx_songs_created_at",
        "idx_songs_is_favorite",
        "idx_songs_rating",
        "idx_songs_parent_song_id",
        "idx_songs_generation_history_id",
        "idx_songs_updated_at",
        "idx_songs_title",
        "idx_songs_duration_seconds",
        "idx_songs_bpm",
        "idx_generation_history_created_at",
        "idx_generation_history_status",
        "idx_generation_history_task_type",
    }
    missing = expected - index_names
    assert not missing, f"Missing indexes: {missing}"


# ---------- 9A.2: SQLite Pragmas ----------


@pytest.mark.asyncio
async def test_wal_journal_mode_enabled(client):
    """Verify WAL journal mode is active after init_db."""
    from bangers.db.connection import get_db

    db = await get_db()
    cursor = await db.execute("PRAGMA journal_mode")
    row = await cursor.fetchone()
    assert row[0] == "wal"


@pytest.mark.asyncio
async def test_foreign_keys_enabled(client):
    from bangers.db.connection import get_db

    db = await get_db()
    cursor = await db.execute("PRAGMA foreign_keys")
    row = await cursor.fetchone()
    assert row[0] == 1


# ---------- 9B: list_songs filter params ----------


@pytest.mark.asyncio
async def test_list_songs_returns_paginated_shape(client, tmp_path):
    """list_songs returns {items, total} with correct pagination."""
    await _create_song(client, tmp_path, title="Song A")
    await _create_song(client, tmp_path, title="Song B")
    await _create_song(client, tmp_path, title="Song C")

    resp = await client.get("/api/songs", params={"limit": 2, "offset": 0})
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 3
    assert len(data["items"]) == 2

    # Second page
    resp2 = await client.get("/api/songs", params={"limit": 2, "offset": 2})
    data2 = resp2.json()
    assert len(data2["items"]) == 1
    assert data2["total"] == 3


@pytest.mark.asyncio
async def test_list_songs_search_filter(client, tmp_path):
    await _create_song(client, tmp_path, title="Rock Anthem", caption="energetic rock")
    await _create_song(client, tmp_path, title="Jazz Ballad", caption="smooth jazz")

    resp = await client.get("/api/songs", params={"search": "rock"})
    data = resp.json()
    assert data["total"] == 1
    assert data["items"][0]["title"] == "Rock Anthem"


@pytest.mark.asyncio
async def test_list_songs_favorite_filter(client, tmp_path):
    song = await _create_song(client, tmp_path, title="Fav Song")
    await _create_song(client, tmp_path, title="Not Fav")

    # Mark one as favorite
    await client.patch(f"/api/songs/{song['id']}", json={"is_favorite": True})

    resp = await client.get("/api/songs", params={"favorite": "true"})
    data = resp.json()
    assert data["total"] == 1
    assert data["items"][0]["id"] == song["id"]


@pytest.mark.asyncio
async def test_list_songs_language_filter(client, tmp_path):
    await _create_song(client, tmp_path, title="English Song", vocal_language="en")
    await _create_song(client, tmp_path, title="Japanese Song", vocal_language="ja")

    resp = await client.get("/api/songs", params={"vocal_language": "ja"})
    data = resp.json()
    assert data["total"] == 1
    assert data["items"][0]["vocal_language"] == "ja"


@pytest.mark.asyncio
async def test_list_songs_sort_order(client, tmp_path):
    await _create_song(client, tmp_path, title="Alpha")
    await _create_song(client, tmp_path, title="Beta")

    resp = await client.get("/api/songs", params={"sort": "title", "order": "asc"})
    data = resp.json()
    titles = [s["title"] for s in data["items"]]
    assert titles == sorted(titles)


# ---------- 9B: bulk_delete_songs ----------


@pytest.mark.asyncio
async def test_bulk_delete_removes_songs_and_files(client, tmp_path):
    s1 = await _create_song(client, tmp_path, title="Del 1")
    s2 = await _create_song(client, tmp_path, title="Del 2")
    await _create_song(client, tmp_path, title="Keep")

    resp = await client.post(
        "/api/songs/bulk-delete",
        json={"song_ids": [s1["id"], s2["id"]]},
    )
    assert resp.status_code == 200
    assert resp.json()["deleted"] == 2

    # Verify deleted songs are gone
    list_resp = await client.get("/api/songs")
    data = list_resp.json()
    assert data["total"] == 1
    assert data["items"][0]["title"] == "Keep"


@pytest.mark.asyncio
async def test_bulk_delete_empty_list(client):
    resp = await client.post("/api/songs/bulk-delete", json={"song_ids": []})
    assert resp.status_code == 200
    assert resp.json()["deleted"] == 0


# ---------- 9B: bulk_update_songs ----------


@pytest.mark.asyncio
async def test_bulk_update_favorite(client, tmp_path):
    s1 = await _create_song(client, tmp_path, title="BU 1")
    s2 = await _create_song(client, tmp_path, title="BU 2")

    resp = await client.patch(
        "/api/songs/bulk",
        json={
            "song_ids": [s1["id"], s2["id"]],
            "updates": {"is_favorite": True},
        },
    )
    assert resp.status_code == 200
    assert resp.json()["updated"] == 2

    # Verify both are favorites
    for sid in [s1["id"], s2["id"]]:
        song_resp = await client.get(f"/api/songs/{sid}")
        assert song_resp.json()["is_favorite"] is True


@pytest.mark.asyncio
async def test_bulk_update_empty(client):
    resp = await client.patch(
        "/api/songs/bulk",
        json={"song_ids": [], "updates": {"rating": 5}},
    )
    assert resp.status_code == 200
    assert resp.json()["updated"] == 0


# ---------- 9A.4: get_variations recursive CTE ----------


@pytest.mark.asyncio
async def test_variations_returns_correct_tree(client, tmp_path):
    """Create grandparent -> parent -> child chain and verify CTE results."""
    grandparent = await _create_song(client, tmp_path, title="Grandparent")
    parent = await _create_song(
        client, tmp_path, title="Parent", parent_song_id=grandparent["id"]
    )
    child = await _create_song(
        client, tmp_path, title="Child", parent_song_id=parent["id"]
    )

    # Check variations for child - should have ancestors
    resp = await client.get(f"/api/songs/{child['id']}/variations")
    assert resp.status_code == 200
    data = resp.json()
    assert data["song"]["id"] == child["id"]
    ancestor_ids = [a["id"] for a in data["ancestors"]]
    assert parent["id"] in ancestor_ids
    assert grandparent["id"] in ancestor_ids
    assert data["children"] == []

    # Check variations for grandparent - should have children
    resp2 = await client.get(f"/api/songs/{grandparent['id']}/variations")
    data2 = resp2.json()
    assert data2["ancestors"] == []
    child_ids = [c["id"] for c in data2["children"]]
    assert parent["id"] in child_ids


@pytest.mark.asyncio
async def test_variations_no_relatives(client, tmp_path):
    """A standalone song has no ancestors or children."""
    song = await _create_song(client, tmp_path, title="Lonely Song")
    resp = await client.get(f"/api/songs/{song['id']}/variations")
    data = resp.json()
    assert data["ancestors"] == []
    assert data["children"] == []


# ---------- 9A.3: list_history LEFT JOIN saved_song_count ----------


@pytest.mark.asyncio
async def test_history_includes_saved_song_count(client, tmp_path):
    """Verify that history entries include correct saved_song_count via LEFT JOIN."""
    history_id = await _create_history_entry(client, tmp_path)

    # Create two songs linked to this history entry
    await _create_song(
        client, tmp_path, title="Saved 1", generation_history_id=history_id
    )
    await _create_song(
        client, tmp_path, title="Saved 2", generation_history_id=history_id
    )

    resp = await client.get("/api/history")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] >= 1

    entry = next(e for e in data["items"] if e["id"] == history_id)
    assert entry["saved_song_count"] == 2


@pytest.mark.asyncio
async def test_history_zero_saved_song_count(client, tmp_path):
    """History entry with no saved songs should have saved_song_count=0."""
    history_id = await _create_history_entry(client, tmp_path)

    resp = await client.get(f"/api/history/{history_id}")
    assert resp.status_code == 200
    data = resp.json()
    assert data["saved_song_count"] == 0
