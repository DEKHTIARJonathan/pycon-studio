# Development

Local development uses the host-native launcher. Docker is for production packaging and smoke tests.

## Toolchain

Install and activate [mise](https://mise.jdx.dev/), then let the repo install the pinned tools:

- Python 3.11
- Node.js 20
- pnpm 9.15.9
- conda via mise's experimental conda backend

`.mise.toml` must keep the conda tool as `"conda:conda" = "latest"`. Do not change it to bare `conda = "latest"`; some mise versions resolve that through the normal registry and fail.

The backend runs in `backend/.conda`, created from `backend/environment.yml`; Python packages are installed from `backend/pyproject.toml`.

## Setup

```bash
mise install
mise run setup
```

`mise run setup` creates:

- `backend/.conda/`
- `backend/data/audio/`
- `backend/data/uploads/`
- `.cache/models/checkpoints/`
- `.cache/models/chat-llm/`
- `.cache/models/huggingface/hub/`

Downloaded models live in `.cache/models/`, so dependency reinstalls and `mise run clean` do not delete them.

Reset runtime state:

```bash
mise run clean
```

This deletes `BANGERS_DATA_DIR` (`backend/data/` by default), then recreates `audio/` and `uploads/`.

## Run

```bash
mise run dev
```

The launcher starts:

- backend: `https://localhost:8000`
- frontend: `https://localhost:3000`
- LAN frontend, when a LAN IP is detected: `https://<ip>:3000`

It also writes combined runtime output to `runtime.log`.

You can run the launcher directly after setup:

```bash
python start.py
python start.py --no-open
python start.py --install
```

## Dev TLS

The launcher generates one self-signed cert/key pair for both uvicorn and Next.js:

- `.cache/tls/dev.pem`
- `.cache/tls/dev-key.pem`

The cert covers `localhost`, `127.0.0.1`, and the detected LAN IP. Browsers will warn on first visit because the cert is self-signed. Click through for the local origin.

HTTPS is used so browser APIs required by radio playback, including `AudioContext.audioWorklet`, work on localhost and LAN URLs.

## Models

The backend starts with no active models. Open **Models** in the running app and download/select:

- one DiT model
- optionally one ACE language model
- optionally one chat LLM for AI DJ, generated titles, and lyric helpers

Selections are persisted in `backend/data/conda-install-bangers.db` and restored on restart. There are no environment variables for preselecting models.

## Cache Paths

Default local paths:

```bash
BANGERS_DATA_DIR=./backend/data
BANGERS_MODEL_CACHE_DIR=./.cache/models
ACESTEP_PROJECT_ROOT=./.cache/models
HF_HOME=./.cache/models/huggingface
HF_HUB_CACHE=./.cache/models/huggingface/hub
```

Use another disk by exporting paths before setup/dev:

```bash
export BANGERS_MODEL_CACHE_DIR=/Volumes/AI/models/conda-install-bangers
export ACESTEP_PROJECT_ROOT="$BANGERS_MODEL_CACHE_DIR"
export HF_HOME="$BANGERS_MODEL_CACHE_DIR/huggingface"
export HF_HUB_CACHE="$HF_HOME/hub"
mise run setup
mise run dev
```

If models redownload unexpectedly, make sure all four model/cache variables point at the same storage layout.

## Tests

```bash
mise run test
```

This runs:

- backend: `cd backend && conda run --prefix .conda pytest -v`
- frontend: `pnpm --dir frontend exec vitest --run`

Run one side manually:

```bash
(cd backend && conda run --prefix .conda pytest -v)
pnpm --dir frontend exec vitest --run
```

## Frontend Only

For frontend-only work, you can run `pnpm dev` inside `frontend/`, but that does not start the backend or configure the shared dev HTTPS cert. Prefer `mise run dev` unless you are deliberately isolating the frontend.
