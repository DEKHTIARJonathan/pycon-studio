# Production Deployment

The current deployment target is one NVIDIA Linux host running Docker Compose. The stack serves HTTP:

- frontend: `http://localhost:3000`
- backend: `http://localhost:8000`

## Prerequisites

- Linux host with an NVIDIA GPU
- Recent NVIDIA driver
- Docker Engine with the Compose plugin
- NVIDIA Container Toolkit configured for Docker

Verify GPU access from containers:

```bash
docker run --rm --gpus all nvidia/cuda:12.8.0-base-ubuntu24.04 nvidia-smi
```

## Configure

The current Compose file exposes only host ports:

```bash
BANGERS_BACKEND_PORT=8000
BANGERS_FRONTEND_PORT=3000
```

Set them in `.env` next to `compose.yaml`:

```bash
cp .env.example .env
```

Runtime state uses Docker named volumes:

- `bangers-data`, mounted at `/data`: SQLite DB, generated audio, uploads
- `bangers-models`, mounted at `/models`: model weights and Hugging Face cache

Named volumes survive rebuilds and `docker compose down`. They are removed only by `docker compose down -v`.

## Launch

```bash
docker compose build
docker compose up -d
```

Open `http://localhost:3000`.

Watch startup:

```bash
docker compose logs -f backend
docker compose logs -f frontend
```

## Prepare Models

The backend starts with no active models. Open **Models** in the frontend and download/select the DiT model, optional ACE language model, and optional chat LLM.

Downloads write to `bangers-models`; selections are stored in `bangers-data` and restored on restart.

## Health

```bash
curl http://localhost:8000/api/health
docker compose ps
```

`/api/health` returns `degraded` until a DiT model is loaded.

## Upgrade

```bash
git pull
docker compose up -d --build
```

Volumes are preserved.

## Backup

List volume names:

```bash
docker volume ls
docker volume inspect conda-install-bangers_bangers-data
docker volume inspect conda-install-bangers_bangers-models
```

Back up volumes with throwaway containers:

```bash
docker run --rm \
  -v conda-install-bangers_bangers-data:/data \
  -v "$PWD":/backup \
  alpine tar -czf /backup/bangers-data.tgz -C /data .

docker run --rm \
  -v conda-install-bangers_bangers-models:/models \
  -v "$PWD":/backup \
  alpine tar -czf /backup/bangers-models.tgz -C /models .
```

Backing up `bangers-data` preserves the library and app settings. Models can be redownloaded if you skip `bangers-models`.

## Common Failures

`could not select device driver "nvidia"`: install or repair NVIDIA Container Toolkit, then rerun the `nvidia-smi` container check.

`permission denied` while creating mount source paths: use the current named-volume Compose file. Bind mounts can fail when Docker cannot traverse the host directory.
