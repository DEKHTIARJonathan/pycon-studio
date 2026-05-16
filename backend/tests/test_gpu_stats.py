import pytest

from bangers.models.common import GpuDeviceStats, GpuStatsResponse
from bangers.services.gpu_stats import parse_nvidia_smi_csv


def test_parse_nvidia_smi_csv_handles_gb10_na_memory() -> None:
    stats = parse_nvidia_smi_csv(
        "0, NVIDIA GB10, GPU-test, 95, 0, [N/A], [N/A], 47.28, [N/A]\n",
        node_id="spark-local-music",
        node_role="worker",
        busy=True,
        holder="worker",
    )

    assert len(stats) == 1
    gpu = stats[0]
    assert gpu.label == "spark-local-music"
    assert gpu.utilization_gpu_percent == 95
    assert gpu.utilization_memory_percent == 0
    assert gpu.vram_used_mb is None
    assert gpu.vram_total_mb is None
    assert gpu.power_draw_w == 47.28
    assert gpu.power_limit_w is None
    assert gpu.busy is True
    assert gpu.holder == "worker"


@pytest.mark.asyncio
async def test_models_gpu_stats_returns_device_list(client, monkeypatch) -> None:
    from bangers.config import settings
    from bangers.routers import models as models_router

    monkeypatch.setattr(settings, "DISTRIBUTED_ROLE", "standalone")
    monkeypatch.setattr(settings, "DISTRIBUTED_WORKERS", ())

    async def fake_read_local_gpu_stats(**_kwargs):
        return GpuStatsResponse(
            device="cuda",
            vram_used_mb=1024.0,
            vram_total_mb=4096.0,
            vram_percent=25.0,
            gpus=[
                GpuDeviceStats(
                    node_id="spark-local-music",
                    label="spark-local-music",
                    utilization_gpu_percent=88.0,
                    power_draw_w=44.5,
                )
            ],
            updated_at=123.0,
        )

    monkeypatch.setattr(models_router, "read_local_gpu_stats", fake_read_local_gpu_stats)

    response = await client.get("/api/models/gpu-stats")

    assert response.status_code == 200
    data = response.json()
    assert data["device"] == "cuda"
    assert data["vram_percent"] == 25.0
    assert data["gpus"][0]["node_id"] == "spark-local-music"
    assert data["gpus"][0]["utilization_gpu_percent"] == 88.0
