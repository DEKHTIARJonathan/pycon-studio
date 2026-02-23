import pytest


@pytest.mark.asyncio
async def test_list_songs_empty(client):
    resp = await client.get("/api/songs")
    assert resp.status_code == 200
    data = resp.json()
    assert data["items"] == []
    assert data["total"] == 0


@pytest.mark.asyncio
async def test_get_nonexistent_song(client):
    resp = await client.get("/api/songs/nonexistent-id")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_delete_nonexistent_song(client):
    resp = await client.delete("/api/songs/nonexistent-id")
    assert resp.status_code == 404
