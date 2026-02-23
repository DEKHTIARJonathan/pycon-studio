import pytest


@pytest.mark.asyncio
async def test_health_returns_200(client):
    resp = await client.get("/api/health")
    assert resp.status_code == 200
    data = resp.json()
    assert "status" in data
    assert "dit_model_loaded" in data
    assert "lm_model_loaded" in data


@pytest.mark.asyncio
async def test_health_degraded_when_models_not_loaded(client):
    resp = await client.get("/api/health")
    data = resp.json()
    assert data["status"] == "degraded"
    assert data["dit_model_loaded"] is False


@pytest.mark.asyncio
async def test_settings_returns_200(client):
    resp = await client.get("/api/settings")
    assert resp.status_code == 200
    data = resp.json()
    assert "settings" in data


@pytest.mark.asyncio
async def test_health_returns_stable_instance_id(client):
    # Same DB across both calls -> instance_id must be identical and non-empty.
    first = await client.get("/api/health")
    second = await client.get("/api/health")

    instance_id = first.json()["instance_id"]
    assert instance_id  # non-empty
    assert len(instance_id) >= 16  # uuid4 string
    assert second.json()["instance_id"] == instance_id


def test_default_settings_have_no_instance_id():
    # instance_id is generated per-DB at init_db time, NOT seeded as a
    # default. Otherwise every fresh DB would share the same id.
    from bangers.db.schema import DEFAULT_SETTINGS

    assert "instance_id" not in DEFAULT_SETTINGS
