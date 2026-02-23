import pytest


@pytest.mark.asyncio
async def test_available_models_iterates_curated_registry_only(client):
    """The /models/available list is driven entirely by `bangers.model_registry`,
    not by upstream `acestep.model_downloader.SUBMODEL_REGISTRY`."""
    from bangers.model_registry import (
        ACE_DIT_MODELS,
        ACE_LM_MODELS,
        ACE_MAIN_BUNDLE,
        CHAT_LLM_MODELS,
    )
    from bangers.services.generation import generation_service

    generation_service.model_download_status.clear()

    response = await client.get("/api/models/available")
    assert response.status_code == 200
    models = {model["name"]: model for model in response.json()["models"]}

    # Curated bundle entries appear and report the bundle repo_id.
    assert models["acestep-v15-turbo"]["model_type"] == "dit"
    assert models["acestep-v15-turbo"]["repo_id"] == ACE_MAIN_BUNDLE.repo_id
    assert models["acestep-5Hz-lm-1.7B"]["model_type"] == "lm"
    assert models["acestep-5Hz-lm-1.7B"]["repo_id"] == ACE_MAIN_BUNDLE.repo_id
    assert models["acestep-5Hz-lm-1.7B"]["size_mb"] > 0

    # Every curated ACE entry is present and uses its registry repo_id.
    for ace in ACE_DIT_MODELS + ACE_LM_MODELS:
        assert ace.name in models, f"expected {ace.name} in available models"
        expected_repo = (
            ACE_MAIN_BUNDLE.repo_id if ace.bundled else ace.repo_id
        )
        assert models[ace.name]["repo_id"] == expected_repo
        assert models[ace.name]["model_type"] == ace.model_type
        assert models[ace.name]["size_mb"] == ace.size_mb

    # Upstream-only entries that are NOT in our curated registry must not
    # leak through anymore.
    assert "acestep-v15-turbo-shift3" not in models
    assert "acestep-v15-turbo-shift1" not in models

    # Chat LLM metadata still surfaces from the registry.
    chat_model_metadata = {model.name: model for model in CHAT_LLM_MODELS}
    for name, metadata in chat_model_metadata.items():
        assert models[name]["model_type"] == "chat_llm"
        assert models[name]["repo_id"] == metadata.repo_id
        assert models[name]["size_mb"] > 0
        assert models[name]["compatibility"] == list(metadata.compatible_runtimes)
        assert models[name]["format"] == metadata.format
        assert models[name]["quantization"] == metadata.quantization


@pytest.mark.asyncio
async def test_downloading_default_ace_lm_uses_main_bundle(client, monkeypatch):
    """Asking for a bundled LM (1.7B) routes through `download_main_model`
    and marks both bundle-visible components as done."""
    import sys
    import types

    calls: list = []

    def download_main_model(checkpoint_dir):
        calls.append(checkpoint_dir)
        return True, "main bundle ready"

    # Inject a stub `acestep.model_downloader` (the conftest mocks the
    # `acestep` package itself, so we attach the submodule explicitly).
    downloader = types.ModuleType("acestep.model_downloader")
    downloader.download_main_model = download_main_model
    monkeypatch.setitem(sys.modules, "acestep.model_downloader", downloader)

    from bangers.services.generation import generation_service

    generation_service.model_download_status.clear()

    response = await client.post(
        "/api/models/download",
        json={"model_name": "acestep-5Hz-lm-1.7B"},
    )

    assert response.status_code == 200
    assert response.json() == {"status": "started"}
    assert calls
    assert generation_service.model_download_status["acestep-5Hz-lm-1.7B"] == "done"
    assert generation_service.model_download_status["acestep-v15-turbo"] == "done"


@pytest.mark.asyncio
async def test_downloading_non_bundled_ace_dit_uses_snapshot_download(client, monkeypatch):
    """Curated ACE entries that aren't part of the main bundle download via
    `huggingface_hub.snapshot_download` directly — never via upstream's
    `download_submodel` (which would reject names not in its own registry).
    """
    import sys
    import types

    from bangers.model_registry import ACE_MODEL_BY_NAME

    snapshot_calls: list[dict] = []

    def fake_snapshot_download(repo_id, local_dir, **_kwargs):
        snapshot_calls.append({"repo_id": repo_id, "local_dir": local_dir})
        return local_dir

    hf_hub = types.ModuleType("huggingface_hub")
    hf_hub.snapshot_download = fake_snapshot_download
    monkeypatch.setitem(sys.modules, "huggingface_hub", hf_hub)

    # Sanity-fail loudly if download_submodel is reached.
    def _boom(*_a, **_kw):
        raise AssertionError("download_submodel must not be called for curated non-bundled entries")

    downloader = types.ModuleType("acestep.model_downloader")
    downloader.download_submodel = _boom
    monkeypatch.setitem(sys.modules, "acestep.model_downloader", downloader)

    from bangers.services.generation import generation_service

    generation_service.model_download_status.clear()

    target = "acestep-v15-base"
    expected_repo = ACE_MODEL_BY_NAME[target].repo_id
    assert ACE_MODEL_BY_NAME[target].bundled is False

    response = await client.post(
        "/api/models/download",
        json={"model_name": target},
    )

    assert response.status_code == 200
    assert response.json() == {"status": "started"}
    assert len(snapshot_calls) == 1
    assert snapshot_calls[0]["repo_id"] == expected_repo
    assert snapshot_calls[0]["local_dir"].endswith(f"checkpoints/{target}")
    assert generation_service.model_download_status[target] == "done"


@pytest.mark.asyncio
async def test_unknown_model_download_is_rejected(client):
    """Names not present in any curated registry are rejected with 400."""
    from bangers.services.generation import generation_service

    generation_service.model_download_status.clear()

    response = await client.post(
        "/api/models/download",
        json={"model_name": "acestep-v15-turbo-shift3"},
    )
    assert response.status_code == 400
    assert "Unknown model" in response.json()["detail"]
