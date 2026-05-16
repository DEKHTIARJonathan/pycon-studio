from __future__ import annotations

import asyncio
import csv
import io
import subprocess
import time

from bangers.models.common import GpuDeviceStats, GpuStatsResponse


_NVIDIA_SMI_QUERY = (
    "index,name,uuid,utilization.gpu,utilization.memory,"
    "memory.used,memory.total,power.draw,power.limit"
)


def _float_or_none(value: str) -> float | None:
    cleaned = value.strip()
    if not cleaned or cleaned in {"[N/A]", "N/A"}:
        return None
    try:
        return float(cleaned)
    except ValueError:
        return None


def _int_or_zero(value: str) -> int:
    try:
        return int(value.strip())
    except ValueError:
        return 0


def parse_nvidia_smi_csv(
    text: str,
    *,
    node_id: str,
    node_role: str,
    busy: bool = False,
    holder: str | None = None,
) -> list[GpuDeviceStats]:
    """Parse the narrow `nvidia-smi --query-gpu` CSV used by the monitor."""
    gpus: list[GpuDeviceStats] = []
    reader = csv.reader(io.StringIO(text.strip()))
    for row in reader:
        if len(row) < 9:
            continue
        used = _float_or_none(row[5])
        total = _float_or_none(row[6])
        vram_percent = None
        if used is not None and total:
            vram_percent = round(used / total * 100.0, 1)
        index = _int_or_zero(row[0])
        label = node_id or f"{node_role or 'node'}-{index}"
        gpus.append(
            GpuDeviceStats(
                node_id=node_id,
                node_role=node_role,
                label=label,
                device_index=index,
                name=row[1].strip(),
                uuid=row[2].strip(),
                utilization_gpu_percent=_float_or_none(row[3]),
                utilization_memory_percent=_float_or_none(row[4]),
                vram_used_mb=used,
                vram_total_mb=total,
                vram_percent=vram_percent,
                power_draw_w=_float_or_none(row[7]),
                power_limit_w=_float_or_none(row[8]),
                busy=busy,
                holder=holder,
            )
        )
    return gpus


def _with_legacy_first_device_fields(response: GpuStatsResponse) -> GpuStatsResponse:
    if not response.gpus:
        return response
    first = response.gpus[0]
    response.vram_used_mb = first.vram_used_mb
    response.vram_total_mb = first.vram_total_mb
    response.vram_percent = first.vram_percent
    return response


def merge_gpu_stats(
    responses: list[GpuStatsResponse],
    *,
    device: str,
) -> GpuStatsResponse:
    gpus: list[GpuDeviceStats] = []
    errors: list[str] = []
    updated_at = time.time()
    for response in responses:
        gpus.extend(response.gpus)
        if response.error:
            errors.append(response.error)
        if response.updated_at:
            updated_at = max(updated_at, response.updated_at)
    merged = GpuStatsResponse(
        device=device,
        gpus=gpus,
        updated_at=updated_at,
        error="; ".join(errors),
    )
    return _with_legacy_first_device_fields(merged)


def _read_local_gpu_stats_sync(
    *,
    node_id: str,
    node_role: str,
    device: str,
    busy: bool = False,
    holder: str | None = None,
) -> GpuStatsResponse:
    updated_at = time.time()
    try:
        result = subprocess.run(
            [
                "nvidia-smi",
                f"--query-gpu={_NVIDIA_SMI_QUERY}",
                "--format=csv,noheader,nounits",
            ],
            check=True,
            capture_output=True,
            text=True,
            timeout=2.0,
        )
    except FileNotFoundError:
        return GpuStatsResponse(
            device=device,
            updated_at=updated_at,
            error="nvidia-smi not found",
        )
    except subprocess.TimeoutExpired:
        return GpuStatsResponse(
            device=device,
            updated_at=updated_at,
            error="nvidia-smi timed out",
        )
    except subprocess.CalledProcessError as exc:
        detail = (exc.stderr or exc.stdout or str(exc)).strip()
        return GpuStatsResponse(
            device=device,
            updated_at=updated_at,
            error=detail or "nvidia-smi failed",
        )

    gpus = parse_nvidia_smi_csv(
        result.stdout,
        node_id=node_id,
        node_role=node_role,
        busy=busy,
        holder=holder,
    )
    response = GpuStatsResponse(device=device, gpus=gpus, updated_at=updated_at)
    return _with_legacy_first_device_fields(response)


async def read_local_gpu_stats(
    *,
    node_id: str,
    node_role: str,
    device: str,
    busy: bool = False,
    holder: str | None = None,
) -> GpuStatsResponse:
    return await asyncio.to_thread(
        _read_local_gpu_stats_sync,
        node_id=node_id,
        node_role=node_role,
        device=device,
        busy=busy,
        holder=holder,
    )
