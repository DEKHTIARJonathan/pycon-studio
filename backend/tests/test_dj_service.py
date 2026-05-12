import asyncio
import json

import pytest


class _FakeGenerationService:
    backend_ready = True
    active_dit_model = "fake-dit"
    active_lm_model = "fake-lm"

    def __init__(self) -> None:
        self.calls: list[dict] = []
        self.job_updates: list[tuple[str, dict]] = []

    def create_job(self) -> str:
        return "job-ace"

    def update_job(self, job_id: str, **kwargs):
        self.job_updates.append((job_id, kwargs))

    async def prepare_params(self, params: dict, **_kwargs) -> dict:
        return dict(params)

    def public_params(self, params: dict) -> dict:
        return dict(params)

    async def generate(self, params: dict, **_kwargs) -> dict:
        self.calls.append(dict(params))
        return {
            "success": True,
            "audios": [
                {
                    "path": "/tmp/fake-ace.flac",
                    "key": "fake-ace.flac",
                    "sample_rate": 48000,
                    "params": dict(params),
                }
            ],
        }


class _FakeGpuLock:
    @property
    def is_locked(self) -> bool:
        return False

    @property
    def holder(self) -> str | None:
        return None

    async def await_acquire(self, holder: str) -> bool:
        return True

    async def release(self, holder: str) -> None:
        return None


class _FakeWsManager:
    def __init__(self) -> None:
        self.messages: list[dict] = []

    async def broadcast(self, message: dict) -> None:
        self.messages.append(message)


class _FakeChatRuntime:
    def is_model_loadable(self, model_name: str) -> bool:
        return True

    async def chat(self, *_args, **_kwargs) -> str:
        return """On it.
```json
{"caption":"dark garage drums","lyrics":"","instrumental":true,"bpm":132}
```"""


async def _fake_configured_runtime():
    return _FakeChatRuntime(), "fake-chat"


class _RetryChatRuntime:
    def __init__(self) -> None:
        self.calls = 0

    async def chat(self, *_args, **_kwargs) -> str:
        self.calls += 1
        return """On it.
```json
{"caption":"vocal garage drums","lyrics":"[verse]\\nGenerated line","instrumental":false,"bpm":132}
```"""


@pytest.mark.asyncio
async def test_dj_message_starts_generation_with_ace_backend(client, monkeypatch):
    from bangers.db.connection import get_db
    from bangers.services import chat_llm
    from bangers.services import generation as generation_module
    from bangers.services.dj_service import dj_service

    fake_generation = _FakeGenerationService()
    monkeypatch.setattr(generation_module, "generation_service", fake_generation)
    monkeypatch.setattr(chat_llm, "require_configured_chat_runtime", _fake_configured_runtime)

    created: list[object] = []

    def fake_create_task(coro):
        created.append(coro)
        coro.close()
        return object()

    monkeypatch.setattr(asyncio, "create_task", fake_create_task)

    db = await get_db()
    await db.execute(
        "INSERT OR REPLACE INTO settings (key, value, updated_at) "
        "VALUES ('dj_model', 'fake-chat', datetime('now'))"
    )
    await db.commit()
    conversation = await dj_service.create_conversation("Existing")

    result = await dj_service.send_message(conversation["id"], "make garage")

    assert result["generation_job_id"] == "job-ace"
    assert result["fallback_notice"] is None
    assert created


@pytest.mark.asyncio
async def test_dj_message_retries_generated_lyrics_after_guardrail_rejection(client, monkeypatch):
    from bangers.db.connection import get_db
    from bangers.services import chat_llm
    from bangers.services import generation as generation_module
    from bangers.services.dj_service import dj_service
    from bangers.services.lyrics_pipeline import LyricsRejectedError

    class RetryingGenerationService(_FakeGenerationService):
        def __init__(self) -> None:
            super().__init__()
            self.prepare_calls = 0

        async def prepare_params(self, params: dict, **_kwargs) -> dict:
            self.prepare_calls += 1
            if self.prepare_calls == 1:
                raise LyricsRejectedError("Guardrail reviewer rejected lyrics")
            return dict(params)

    fake_generation = RetryingGenerationService()
    runtime = _RetryChatRuntime()

    async def configured_runtime():
        return runtime, "fake-chat"

    monkeypatch.setattr(generation_module, "generation_service", fake_generation)
    monkeypatch.setattr(chat_llm, "require_configured_chat_runtime", configured_runtime)

    created: list[object] = []

    def fake_create_task(coro):
        created.append(coro)
        coro.close()
        return object()

    monkeypatch.setattr(asyncio, "create_task", fake_create_task)

    db = await get_db()
    await db.execute(
        "INSERT OR REPLACE INTO settings (key, value, updated_at) "
        "VALUES ('dj_model', 'fake-chat', datetime('now'))"
    )
    await db.commit()
    conversation = await dj_service.create_conversation("Existing")

    result = await dj_service.send_message(conversation["id"], "make vocal garage")

    assert result["generation_job_id"] == "job-ace"
    assert fake_generation.prepare_calls == 2
    assert runtime.calls == 2
    assert created


@pytest.mark.asyncio
async def test_dj_generation_maps_params_for_ace(client, monkeypatch):
    from bangers.db.connection import get_db
    from bangers.services import deferred_titles as deferred_titles_module
    from bangers.services import generation as generation_module
    from bangers.services import gpu_lock as gpu_lock_module
    from bangers.services.dj_service import dj_service
    from bangers.ws import manager as manager_module

    fake_generation = _FakeGenerationService()
    fake_ws = _FakeWsManager()
    monkeypatch.setattr(generation_module, "generation_service", fake_generation)
    monkeypatch.setattr(gpu_lock_module, "gpu_lock", _FakeGpuLock())
    monkeypatch.setattr(manager_module, "generation_ws_manager", fake_ws)
    monkeypatch.setattr(
        deferred_titles_module,
        "schedule_history_title_retry",
        lambda **_kwargs: None,
    )

    await dj_service._run_dj_generation(
        "job-ace",
        {
            "caption": "dark garage drums",
            "lyrics": "",
            "instrumental": True,
            "batch_size": 8,
            "audio_format": "flac",
            "thinking": True,
        },
        dj_model="fake-chat",
    )

    assert fake_generation.calls
    call = fake_generation.calls[0]
    assert call["caption"] == "dark garage drums"
    assert call["batch_size"] == 1
    assert call["audio_format"] == "flac"
    assert call["dit_model"] == "fake-dit"
    assert call["lm_model"] == "fake-lm"
    assert call["dj_model"] == "fake-chat"

    db = await get_db()
    cursor = await db.execute(
        "SELECT params_json, status FROM generation_history WHERE id = ?",
        ("job-ace",),
    )
    history = await cursor.fetchone()
    assert history["status"] == "completed"
    params = json.loads(history["params_json"])
    assert params["caption"] == "dark garage drums"
    assert params["audio_format"] == "flac"


@pytest.mark.asyncio
async def test_dj_generation_treats_string_false_instrumental_as_vocal(client, monkeypatch):
    from bangers.services import deferred_titles as deferred_titles_module
    from bangers.services import generation as generation_module
    from bangers.services import gpu_lock as gpu_lock_module
    from bangers.services.dj_service import dj_service
    from bangers.ws import manager as manager_module

    fake_generation = _FakeGenerationService()
    monkeypatch.setattr(generation_module, "generation_service", fake_generation)
    monkeypatch.setattr(gpu_lock_module, "gpu_lock", _FakeGpuLock())
    monkeypatch.setattr(manager_module, "generation_ws_manager", _FakeWsManager())
    monkeypatch.setattr(
        deferred_titles_module,
        "schedule_history_title_retry",
        lambda **_kwargs: None,
    )

    await dj_service._run_dj_generation(
        "job-vocal",
        {
            "caption": "vocal garage drums",
            "lyrics": "[verse]\nRaw vocal line",
            "instrumental": "false",
            "audio_format": "flac",
        },
        dj_model="fake-chat",
    )

    assert fake_generation.calls
    call = fake_generation.calls[0]
    assert call["instrumental"] is False
    assert call["lyrics"] == "[verse]\nRaw vocal line"
