import sys
from unittest.mock import MagicMock

# Mock GPU-dependent modules before any bangers import.
# mlx_lm and transformers are included because mlx_lm's import chain
# (mlx_lm → transformers → importlib.util.find_spec("torch")) fails
# when torch is mocked.
for mod_name in [
    "acestep", "acestep.handler", "acestep.llm_inference",
    "acestep.inference",
    "torch", "torch.cuda", "torch.backends", "torch.backends.mps",
    "mlx_lm", "transformers",
]:
    sys.modules.setdefault(mod_name, MagicMock())

import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport


@pytest_asyncio.fixture
async def client(tmp_path):
    """Provide httpx AsyncClient against the FastAPI app."""
    from bangers.config import settings

    # Point all paths to tmp_path — must set DB_PATH explicitly
    data_dir = tmp_path / "data"
    settings.DATA_DIR = data_dir
    settings.DB_PATH = data_dir / "pip-install-bangers.db"
    settings.AUDIO_DIR = data_dir / "audio"
    settings.UPLOADS_DIR = data_dir / "uploads"
    settings.MODEL_CACHE_DIR = tmp_path / "model-cache"
    settings.ACESTEP_PROJECT_ROOT = str(settings.MODEL_CACHE_DIR)
    settings.HF_HOME_DIR = settings.MODEL_CACHE_DIR / "huggingface"
    settings.HF_HUB_CACHE_DIR = settings.HF_HOME_DIR / "hub"

    # Create dirs before init_db
    data_dir.mkdir(parents=True, exist_ok=True)
    (data_dir / "audio").mkdir(exist_ok=True)
    (data_dir / "uploads").mkdir(exist_ok=True)

    # Ensure generation service is uninitialized so all delegating properties
    # return their safe defaults (False, "", etc.).
    from bangers.backends.ace_step_backend import AceStepBackend
    from bangers.services.generation import generation_service

    generation_service.backend = AceStepBackend()
    generation_service._jobs.clear()
    generation_service._cancelled.clear()
    generation_service.model_download_status.clear()
    generation_service._clear_loading()

    from bangers.db.connection import init_db, close_db

    await init_db()

    from bangers.main import app

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

    await close_db()
