import json
import uuid

import pytest


class _FakeBackend:
    is_ready = True


class _FakeGpuLock:
    def __init__(self) -> None:
        self._locked = False
        self._holder: str | None = None

    @property
    def is_locked(self) -> bool:
        return self._locked

    @property
    def holder(self) -> str | None:
        return self._holder

    async def acquire(self, holder: str) -> bool:
        if self._locked:
            return False
        self._locked = True
        self._holder = holder
        return True

    async def await_acquire(self, holder: str) -> bool:
        self._locked = True
        self._holder = holder
        return True

    async def release(self, holder: str) -> None:
        if self._holder == holder:
            self._locked = False
            self._holder = None


class _FakeGenerationService:
    def __init__(
        self,
        audio_dir,
        *,
        sample: dict | None = None,
        backend=None,
        lock=None,
    ) -> None:
        self.dit_initialized = True
        self.lm_initialized = sample is not None
        self.calls: list[dict] = []
        self.audio_dir = audio_dir
        self.sample = sample
        self.backend = backend or _FakeBackend()
        self.backend_ready = self.backend.is_ready
        self.active_dit_model = "fake-dit"
        self.active_lm_model = ""
        self.lock = lock
        self.sample_lock_holders: list[str | None] = []
        self.generate_lock_holders: list[str | None] = []

    async def prepare_params(self, params: dict, **_kwargs) -> dict:
        return dict(params)

    def public_params(self, params: dict) -> dict:
        return dict(params)

    async def generate(self, params: dict, **_kwargs) -> dict:
        if self.lock is not None:
            self.generate_lock_holders.append(self.lock.holder)
        self.calls.append(dict(params))
        path = self.audio_dir / f"{uuid.uuid4().hex}.flac"
        path.write_bytes(b"fake audio")
        return {
            "success": True,
            "audios": [{
                "path": str(path),
                "key": path.name,
                "sample_rate": 48000,
                "params": dict(params),
            }],
        }

    async def create_sample(self, **_kwargs) -> dict:
        if self.lock is not None:
            self.sample_lock_holders.append(self.lock.holder)
        return self.sample or {"success": False}


async def _station(**overrides):
    from bangers.services.radio_service import radio_service

    data = {
        "name": f"Station {uuid.uuid4().hex[:6]}",
        "description": "",
        "genre": "pop",
        "mood": "bright",
        "caption_template": "A bright pop song with modern production",
        "instrumental": False,
        "duration_min": 10,
        "duration_max": 10,
        **overrides,
    }
    return await radio_service.create_station(data)


@pytest.mark.asyncio
async def test_vocal_radio_station_generates_and_saves_lyrics(client, monkeypatch):
    from bangers.db.connection import get_db
    from bangers.services import radio_service as radio_module
    from bangers.services.radio_service import radio_service
    from bangers.config import settings

    fake_generation = _FakeGenerationService(settings.AUDIO_DIR)
    monkeypatch.setattr(radio_module, "generation_service", fake_generation)
    monkeypatch.setattr(radio_module, "gpu_lock", _FakeGpuLock())

    async def lyric_spec(_station):
        return {
            "caption": "A vocal pop song with glittering hooks",
            "lyrics": "[verse]\nLights rise\n\n[chorus]\nWe sing tonight",
        }

    async def title(*_args, **_kwargs):
        return "Radio Vocal"

    monkeypatch.setattr(radio_service, "_generate_song_spec_with_llm", lyric_spec)
    monkeypatch.setattr(radio_service, "_generate_title_with_llm", title)

    station = await _station(instrumental=False, vocal_language="english")
    result = await radio_service.generate_next_track(station.id)

    assert result["success"] is True
    assert fake_generation.calls[0]["instrumental"] is False
    assert fake_generation.calls[0]["lyrics"].startswith("[verse]")

    db = await get_db()
    cursor = await db.execute(
        "SELECT lyrics, instrumental FROM songs WHERE id = ?",
        (result["song"]["id"],),
    )
    row = await cursor.fetchone()

    assert row["lyrics"].startswith("[verse]")
    assert row["instrumental"] == 0

    cursor = await db.execute("SELECT params_json, result_json FROM generation_history ORDER BY created_at DESC LIMIT 1")
    history = await cursor.fetchone()
    params = json.loads(history["params_json"])
    results = json.loads(history["result_json"])
    assert params["lyrics"].startswith("[verse]")
    assert results[0]["params"]["lyrics"].startswith("[verse]")


@pytest.mark.asyncio
async def test_instrumental_radio_station_keeps_empty_lyrics(client, monkeypatch):
    from bangers.db.connection import get_db
    from bangers.services import radio_service as radio_module
    from bangers.services.radio_service import radio_service
    from bangers.config import settings

    fake_generation = _FakeGenerationService(settings.AUDIO_DIR)
    monkeypatch.setattr(radio_module, "generation_service", fake_generation)
    monkeypatch.setattr(radio_module, "gpu_lock", _FakeGpuLock())

    async def no_caption(_station):
        return None

    async def title(*_args, **_kwargs):
        return "Radio Instrumental"

    monkeypatch.setattr(radio_service, "_generate_caption_with_llm", no_caption)
    monkeypatch.setattr(radio_service, "_generate_title_with_llm", title)

    station = await _station(instrumental=True)
    result = await radio_service.generate_next_track(station.id)

    assert result["success"] is True
    assert fake_generation.calls[0]["instrumental"] is True
    assert fake_generation.calls[0]["lyrics"] == ""

    db = await get_db()
    cursor = await db.execute("SELECT lyrics, instrumental FROM songs ORDER BY created_at DESC LIMIT 1")
    row = await cursor.fetchone()
    assert row["lyrics"] == ""
    assert row["instrumental"] == 1


@pytest.mark.asyncio
async def test_invalid_radio_llm_json_falls_back_to_template_lyrics(client, monkeypatch):
    from bangers.services import radio_service as radio_module
    from bangers.services.radio_service import radio_service
    from bangers.config import settings

    class BadJsonProvider:
        name = "bad-json"

        async def chat(self, *_args, **_kwargs):
            return "not json"

    fake_generation = _FakeGenerationService(settings.AUDIO_DIR)
    monkeypatch.setattr(radio_module, "generation_service", fake_generation)
    monkeypatch.setattr(radio_module, "gpu_lock", _FakeGpuLock())

    async def bad_llm():
        return BadJsonProvider(), "bad-model", "caption guidance"

    async def title(*_args, **_kwargs):
        return "Fallback Lyrics"

    monkeypatch.setattr(radio_service, "_get_radio_llm", bad_llm)
    monkeypatch.setattr(radio_service, "_generate_title_with_llm", title)

    station = await _station(instrumental=False)
    result = await radio_service.generate_next_track(station.id)

    assert result["success"] is True
    assert fake_generation.calls[0]["lyrics"].startswith("[verse]")
    assert "song" in fake_generation.calls[0]["lyrics"].lower()


@pytest.mark.asyncio
async def test_radio_rejected_generated_lyrics_stop_generation(client, monkeypatch):
    from bangers.services import radio_service as radio_module
    from bangers.services.radio_service import radio_service
    from bangers.services.lyrics_pipeline import LyricsRejectedError
    from bangers.config import settings

    fake_generation = _FakeGenerationService(settings.AUDIO_DIR)
    monkeypatch.setattr(radio_module, "generation_service", fake_generation)
    monkeypatch.setattr(radio_module, "gpu_lock", _FakeGpuLock())

    async def rejected_spec(_station):
        raise LyricsRejectedError("Generated lyrics were too unsafe.")

    monkeypatch.setattr(radio_service, "_generate_song_spec_with_llm", rejected_spec)

    station = await _station(instrumental=False)
    result = await radio_service.generate_next_track(station.id)

    assert result["success"] is False
    assert "Code of Conduct" in result["error"]
    assert fake_generation.calls == []


@pytest.mark.asyncio
async def test_radio_sample_fallback_runs_under_radio_gpu_lock(client, monkeypatch):
    from bangers.config import settings
    from bangers.services import deferred_titles as deferred_titles_module
    from bangers.services import radio_service as radio_module
    from bangers.services.radio_service import radio_service

    fake_lock = _FakeGpuLock()
    fake_generation = _FakeGenerationService(
        settings.AUDIO_DIR,
        sample={
            "success": True,
            "caption": "A sampled vocal pop song",
            "lyrics": "[verse]\nSample lyric\n\n[chorus]\nRadio light",
            "instrumental": False,
        },
        lock=fake_lock,
    )
    monkeypatch.setattr(radio_module, "generation_service", fake_generation)
    monkeypatch.setattr(radio_module, "gpu_lock", fake_lock)
    monkeypatch.setattr(
        deferred_titles_module,
        "schedule_radio_title_retry",
        lambda **_kwargs: None,
    )

    async def no_llm_spec(_station):
        return None

    monkeypatch.setattr(radio_service, "_generate_song_spec_with_llm", no_llm_spec)

    station = await _station(instrumental=False)
    result = await radio_service.generate_next_track(station.id)

    assert result["success"] is True
    assert fake_generation.sample_lock_holders == ["radio"]
    assert fake_generation.generate_lock_holders == ["radio"]


@pytest.mark.asyncio
async def test_radio_rejects_when_music_backend_not_ready(client, monkeypatch):
    from bangers.services import radio_service as radio_module
    from bangers.services.radio_service import radio_service
    from bangers.config import settings

    class _NotReady:
        is_ready = False

    fake_generation = _FakeGenerationService(
        settings.AUDIO_DIR,
        backend=_NotReady(),
    )
    monkeypatch.setattr(radio_module, "generation_service", fake_generation)
    monkeypatch.setattr(radio_module, "gpu_lock", _FakeGpuLock())

    station = await _station(instrumental=True)
    result = await radio_service.generate_next_track(station.id)

    assert result["success"] is False
    assert "not loaded" in result["error"]


@pytest.mark.asyncio
async def test_preset_patch_only_persists_lyrics_toggle(client):
    from bangers.db.connection import get_db

    db = await get_db()
    station_id = str(uuid.uuid4())
    await db.execute(
        """INSERT INTO radio_stations (
            id, name, description, is_preset, caption_template,
            genre, mood, instrumental, created_at, updated_at
        ) VALUES (?, 'Preset A', '', 1, '', 'pop', 'bright', 1, datetime('now'), datetime('now'))""",
        (station_id,),
    )
    await db.commit()

    resp = await client.patch(
        f"/api/radio/stations/{station_id}",
        json={"name": "Changed", "instrumental": False},
    )

    assert resp.status_code == 200
    body = resp.json()
    assert body["name"] == "Preset A"
    assert body["instrumental"] is False
