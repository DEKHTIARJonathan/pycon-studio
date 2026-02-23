import pytest


@pytest.mark.asyncio
async def test_inference_steps_over_50_rejected(client):
    resp = await client.post("/api/generate", json={
        "inference_steps": 100,
        "caption": "test",
    })
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_batch_size_over_8_rejected(client):
    resp = await client.post("/api/generate", json={
        "batch_size": 20,
        "caption": "test",
    })
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_invalid_audio_format_rejected(client):
    resp = await client.post("/api/generate", json={
        "audio_format": "exe",
        "caption": "test",
    })
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_invalid_task_type_rejected(client):
    resp = await client.post("/api/generate", json={
        "task_type": "invalid_type",
        "caption": "test",
    })
    assert resp.status_code == 422
