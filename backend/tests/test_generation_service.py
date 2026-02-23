from typing import Any, Callable, Optional

import pytest

from bangers.services.generation import GenerationService


class _FakeBackend:
    def __init__(self, *, ready: bool = False) -> None:
        self._ready = ready
        self.last_generate_params: dict[str, Any] | None = None
        self.dit_initialized = ready
        self.lm_initialized = False
        self.lm_disabled = False
        self.active_dit_model = "fake-dit" if ready else ""
        self.active_lm_model = ""
        self.dit_handler = None

    async def initialize(self, **_kwargs: Any) -> tuple[str, bool]:
        self._ready = True
        self.dit_initialized = True
        return "ready", True

    async def unload(self) -> None:
        self._ready = False
        self.dit_initialized = False

    async def generate(
        self,
        params_dict: dict[str, Any],
        progress_callback: Optional[Callable] = None,
    ) -> dict[str, Any]:
        self.last_generate_params = dict(params_dict)
        return {"success": True, "audios": []}

    @property
    def is_ready(self) -> bool:
        return self._ready

    @property
    def device(self) -> str:
        return "test"

    @property
    def init_stage(self) -> str:
        return "ready" if self._ready else "idle"

    @property
    def init_error(self) -> str:
        return ""

    @property
    def download_progress(self) -> float:
        return 0.0

    async def initialize_dit(self, **_kwargs: Any) -> tuple[str, bool]:
        self._ready = True
        self.dit_initialized = True
        return "ready", True

    async def initialize_lm(self, **_kwargs: Any) -> tuple[str, bool]:
        self.lm_initialized = True
        return "ready", True

    async def create_sample(self, **_kwargs: Any) -> dict[str, Any]:
        return {"success": True}

    async def format_sample(self, **_kwargs: Any) -> dict[str, Any]:
        return {"success": True}


@pytest.mark.asyncio
async def test_backend_ready_uses_single_backend_state():
    service = GenerationService()
    service.backend = _FakeBackend(ready=True)

    assert service.backend_ready is True
    assert service.dit_initialized is True


@pytest.mark.asyncio
async def test_generate_rejects_when_backend_not_initialized():
    service = GenerationService()
    service.backend = _FakeBackend(ready=False)

    result = await service.generate({"caption": "x"})
    assert result["success"] is False
    assert "not initialized" in result["error"]


@pytest.mark.asyncio
async def test_loading_state_is_explicit_and_cleared():
    service = GenerationService()

    assert service.loading_state is None
    service._set_loading("dit", "acestep-v15-turbo")
    assert service.loading_state == {
        "kind": "dit",
        "model_name": "acestep-v15-turbo",
        "started_at": service.loading_state["started_at"],
    }
    service._clear_loading()
    assert service.loading_state is None


@pytest.mark.asyncio
async def test_generate_normalizes_ace_params():
    service = GenerationService()
    backend = _FakeBackend(ready=True)
    service.backend = backend

    result = await service.generate({
        "caption": "bright synth pop",
        "audio_format": "unsupported",
        "vocal_language": "fr",
    })

    assert result["success"] is True
    assert backend.last_generate_params is not None
    assert backend.last_generate_params["caption"] == "bright synth pop"
    assert backend.last_generate_params["audio_format"] == "flac"
    assert backend.last_generate_params["vocal_language"] == "en"
