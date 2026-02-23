import pytest


@pytest.mark.asyncio
async def test_generation_request_uses_saved_defaults_for_omitted_fields(client):
    from bangers.db.connection import get_db
    from bangers.models.generation import GenerateRequest
    from bangers.routers.generation import _apply_saved_generation_defaults

    db = await get_db()
    saved_defaults = {
        "batch_size": "1",
        "default_duration": "142",
        "inference_steps": "12",
        "guidance_scale": "4.5",
        "thinking": "false",
        "audio_format": "mp3",
    }
    for key, value in saved_defaults.items():
        await db.execute(
            "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)",
            (key, value),
        )
    await db.commit()

    request = GenerateRequest(caption="test")
    await _apply_saved_generation_defaults(request)

    assert request.batch_size == 1
    assert request.duration == 142
    assert request.inference_steps == 12
    assert request.guidance_scale == 4.5
    assert request.thinking is False
    assert request.audio_format == "mp3"


@pytest.mark.asyncio
async def test_generation_request_keeps_explicit_values_except_duration(client):
    from bangers.db.connection import get_db
    from bangers.models.generation import GenerateRequest
    from bangers.routers.generation import _apply_saved_generation_defaults

    db = await get_db()
    for key, value in {"batch_size": "1", "default_duration": "142"}.items():
        await db.execute(
            "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)",
            (key, value),
        )
    await db.commit()

    request = GenerateRequest(caption="test", batch_size=3, duration=180)
    await _apply_saved_generation_defaults(request)

    assert request.batch_size == 3
    assert request.duration == 142


@pytest.mark.asyncio
async def test_generation_request_replaces_auto_duration_with_saved_default(client):
    from bangers.db.connection import get_db
    from bangers.models.generation import GenerateRequest
    from bangers.routers.generation import _apply_saved_generation_defaults

    db = await get_db()
    await db.execute(
        "INSERT OR REPLACE INTO settings (key, value) VALUES ('default_duration', '155')"
    )
    await db.commit()

    request = GenerateRequest(caption="test", duration=-1)
    await _apply_saved_generation_defaults(request)

    assert request.duration == 155


@pytest.mark.asyncio
async def test_generation_request_replaces_explicit_duration_with_saved_default(client):
    from bangers.db.connection import get_db
    from bangers.models.generation import GenerateRequest
    from bangers.routers.generation import _apply_saved_generation_defaults

    db = await get_db()
    await db.execute(
        "INSERT OR REPLACE INTO settings (key, value) VALUES ('default_duration', '155')"
    )
    await db.commit()

    request = GenerateRequest(caption="test", duration=220)
    await _apply_saved_generation_defaults(request)

    assert request.duration == 155
