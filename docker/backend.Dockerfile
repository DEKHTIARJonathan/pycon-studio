FROM nvidia/cuda:12.8.0-cudnn-runtime-ubuntu24.04

ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    UV_LINK_MODE=copy \
    BANGERS_DOCKER=1 \
    BANGERS_HOST=0.0.0.0 \
    BANGERS_PORT=8000 \
    BANGERS_DATA_DIR=/data \
    BANGERS_MODEL_CACHE_DIR=/models \
    ACESTEP_PROJECT_ROOT=/models \
    HF_HOME=/models/huggingface \
    HF_HUB_CACHE=/models/huggingface/hub

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        build-essential \
        ca-certificates \
        curl \
        ffmpeg \
        git \
        libsndfile1 \
        python3 \
        python3-dev \
        python3-venv \
    && rm -rf /var/lib/apt/lists/*

RUN curl -LsSf https://astral.sh/uv/install.sh | sh
ENV PATH="/root/.local/bin:/app/backend/.venv/bin:${PATH}"

WORKDIR /app/backend

COPY backend/pyproject.toml backend/uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project

COPY backend ./
RUN uv sync --frozen --no-dev

EXPOSE 8000

CMD ["uv", "run", "--no-sync", "pip-install-bangers"]
