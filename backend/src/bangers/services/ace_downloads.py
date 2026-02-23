"""Registry-driven download helpers for ACE-Step weights.

These helpers replace ad-hoc calls into `acestep.model_downloader` for
*non-bundle* entries so we no longer depend on the upstream
`SUBMODEL_REGISTRY` to know what's downloadable. Bundled members still
flow through `download_main_model` because the four bundle directories
ship together as one HF snapshot.
"""

from __future__ import annotations

from pathlib import Path

from loguru import logger

from bangers.model_registry import ACE_MODEL_BY_NAME, DownloadableAceModel


def ensure_ace_model(
    model_name: str,
    checkpoints_dir: Path,
) -> tuple[bool, str]:
    """Ensure an ACE DiT or LM model is on disk, downloading if missing.

    Returns (success, message). Unknown names return (False, ...).
    """
    model_dir = checkpoints_dir / model_name
    if model_dir.exists():
        return True, f"ACE model '{model_name}' is available"

    model: DownloadableAceModel | None = ACE_MODEL_BY_NAME.get(model_name)
    if model is None:
        return False, f"Unknown ACE model: {model_name}"

    checkpoints_dir.mkdir(parents=True, exist_ok=True)

    if model.bundled:
        from acestep.model_downloader import download_main_model

        logger.info(
            f"[ACE Download] '{model_name}' is bundled; pulling main bundle"
        )
        return download_main_model(checkpoints_dir)

    from huggingface_hub import snapshot_download

    logger.info(
        f"[ACE Download] Downloading '{model_name}' from {model.repo_id} -> {model_dir}"
    )
    try:
        snapshot_download(repo_id=model.repo_id, local_dir=str(model_dir))
    except Exception as exc:
        logger.exception(f"[ACE Download] Failed: {model_name}")
        return False, str(exc)
    return True, f"ACE model '{model_name}' downloaded from {model.repo_id}"
