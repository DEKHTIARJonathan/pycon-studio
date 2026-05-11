FROM nvidia/cuda:12.8.0-cudnn-runtime-ubuntu24.04

ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    BANGERS_DOCKER=1 \
    BANGERS_HOST=0.0.0.0 \
    BANGERS_PORT=8000 \
    BANGERS_DATA_DIR=/data \
    BANGERS_MODEL_CACHE_DIR=/models \
    ACESTEP_PROJECT_ROOT=/models \
    HF_HOME=/models/huggingface \
    HF_HUB_CACHE=/models/huggingface/hub \
    CONDA_DIR=/opt/conda \
    BANGERS_CONDA_ENV=/opt/bangers-conda

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        bash \
        bzip2 \
        build-essential \
        ca-certificates \
        curl \
        git \
    && rm -rf /var/lib/apt/lists/*

RUN curl -L -o /tmp/miniforge.sh \
        https://github.com/conda-forge/miniforge/releases/latest/download/Miniforge3-Linux-x86_64.sh \
    && bash /tmp/miniforge.sh -b -p "${CONDA_DIR}" \
    && rm /tmp/miniforge.sh \
    && "${CONDA_DIR}/bin/conda" config --system --set channel_priority strict \
    && "${CONDA_DIR}/bin/conda" clean -afy

ENV PATH="${BANGERS_CONDA_ENV}/bin:${CONDA_DIR}/bin:${PATH}"

WORKDIR /app/backend

COPY backend/environment.yml backend/pyproject.toml ./
RUN conda env create --prefix "${BANGERS_CONDA_ENV}" --file environment.yml \
    && conda clean -afy

COPY backend ./
RUN python -m pip install --prefer-binary --extra-index-url https://download.pytorch.org/whl/cu130 .

EXPOSE 8000

CMD ["conda-install-bangers"]
