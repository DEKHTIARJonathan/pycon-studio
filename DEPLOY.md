# Production Deployment

This guide deploys conda install bangers with Docker Compose on a single NVIDIA Linux host.

It mirrors `mise run dev` exactly, just containerized: backend on port 8000, frontend on port 3000, with two Docker-managed named volumes for persistent state.

## Prerequisites

- Linux host with an NVIDIA GPU
- Recent NVIDIA driver
- Docker Engine with the Compose plugin
- NVIDIA Container Toolkit configured for Docker

Check GPU container access:

```bash
docker run --rm --gpus all nvidia/cuda:12.8.0-base-ubuntu24.04 nvidia-smi
```

## Configure

Only two things are configurable: the host ports.

```bash
BANGERS_BACKEND_PORT=8000   # default
BANGERS_FRONTEND_PORT=3000  # default
```

Set them inline or via a `.env` file next to `compose.yaml`. Anything else is baked into the images.

Persistent state lives in two Docker named volumes:

- `bangers-data` — mounted at `/data` (SQLite DB, generated audio, uploads)
- `bangers-models` — mounted at `/models` (model weights and Hugging Face cache)

These are created automatically on first run and survive `docker compose down` / rebuilds. Use named volumes (instead of host bind mounts) so the Docker daemon doesn't run into host filesystem permission issues — common on multi-user servers, rootless Docker, and DGX-style hosts where home directories are mode `700`.

## Launch

```bash
docker compose build
docker compose up -d
```

Open <http://localhost:3000>.

Watch startup:

```bash
docker compose logs -f backend
docker compose logs -f frontend
```

## Prepare Models

The backend boots with no models loaded. Open the **Models** page in the frontend and click Download / Select for the DiT, language model, and chat LLM you want. Downloads write into the `bangers-models` volume; your selection is persisted in `bangers-data` so it auto-loads on every restart.

## Health Check

```bash
curl http://localhost:8000/api/health
docker compose ps
```

If the backend is still downloading or loading models, `/api/health` may return `degraded` until generation is ready.

## Upgrades

```bash
git pull
docker compose up -d --build 
```

Volumes are preserved across rebuilds and `docker compose down`. They are only removed by `docker compose down -v`.

## Inspect or Backup

List volumes and find their on-disk path:

```bash
docker volume ls
docker volume inspect pip-install-bangers_bangers-data
docker volume inspect pip-install-bangers_bangers-models
```

Back up via a throwaway container (works regardless of where Docker stores the volume):

```bash
docker run --rm \
  -v pip-install-bangers_bangers-data:/data \
  -v "$PWD":/backup \
  alpine tar -czf /backup/bangers-data.tgz -C /data .

docker run --rm \
  -v pip-install-bangers_bangers-models:/models \
  -v "$PWD":/backup \
  alpine tar -czf /backup/bangers-models.tgz -C /models .
```

Backing up only `bangers-data` is enough to preserve the user library and app settings; models can be redownloaded.

## Common Failures

`could not select device driver "nvidia"` — install or repair NVIDIA Container Toolkit, then rerun the `nvidia-smi` Docker check.

`error while creating mount source path ... permission denied` — you're using bind mounts on a host where the Docker daemon can't traverse your home directory. The current `compose.yaml` uses named volumes specifically to avoid this; if you've edited it back to bind mounts, revert.
