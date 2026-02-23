import pytest


def test_generation_cancelled_bypasses_broad_exception_handlers():
    from bangers.routers.generation import GenerationCancelled

    with pytest.raises(GenerationCancelled):
        try:
            raise GenerationCancelled()
        except Exception as exc:
            pytest.fail(f"Cancellation should not be handled as a generation failure: {exc!r}")


@pytest.mark.asyncio
async def test_generate_when_dit_not_loaded(client):
    resp = await client.post("/api/generate", json={
        "task_type": "text2music",
        "caption": "test song",
    })
    assert resp.status_code == 503


@pytest.mark.asyncio
async def test_generate_no_dit_selected_returns_explicit_error(client):
    from bangers.backends.ace_step_backend import AceStepBackend
    from bangers.services.generation import generation_service

    ace = AceStepBackend()
    ace.active_dit_model = ""
    ace.dit_initialized = False
    generation_service.backend = ace

    resp = await client.post("/api/generate", json={
        "task_type": "text2music",
        "caption": "test song",
    })
    assert resp.status_code == 503
    detail = resp.json()["detail"]
    assert detail["error"] == "no_dit_model_selected"
    assert "Models page" in detail["message"]
    assert detail["missing"] == ["dit_model"]


@pytest.mark.asyncio
async def test_generate_dit_loading_distinct_from_no_selection(client):
    from bangers.backends.ace_step_backend import AceStepBackend
    from bangers.services.generation import generation_service

    ace = AceStepBackend()
    ace.active_dit_model = "some-dit"
    ace.dit_initialized = False
    generation_service.backend = ace

    resp = await client.post("/api/generate", json={
        "task_type": "text2music",
        "caption": "test song",
    })
    assert resp.status_code == 503
    detail = resp.json()["detail"]
    assert detail["error"] == "dit_model_not_loaded"
    assert "some-dit" in detail["message"]


@pytest.mark.asyncio
async def test_get_nonexistent_job(client):
    resp = await client.get("/api/generate/nonexistent-id")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_format_when_lm_not_loaded(client):
    resp = await client.post("/api/format", json={
        "caption": "test caption",
    })
    assert resp.status_code == 503


@pytest.mark.asyncio
async def test_sample_when_lm_not_loaded(client):
    resp = await client.post("/api/sample", json={
        "query": "happy pop song",
    })
    assert resp.status_code == 503
