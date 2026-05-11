# Development

This guide is for local development without rebuilding Docker containers.

## Prerequisites

- [mise](https://mise.jdx.dev/) installed and activated in your shell
- conda; `mise install` installs it from `.mise.toml`
- Git
- macOS, Linux, or Windows with a shell that can run the listed commands

The repo pins its local toolchain in `.mise.toml`:

- Python 3.11
- Node.js 20
- pnpm 9
- conda, declared as `"conda:conda" = "latest"` using mise's conda backend
- `openssl` (system package; used to mint a self-signed dev TLS cert)

Mise's conda backend is experimental, so `.mise.toml` sets
`settings.experimental = true` locally. Contributors should not need to run
`mise settings experimental=true` globally for this repo.
Do not change the tool entry to bare `conda = "latest"`; some mise versions
resolve that through the normal registry and fail before the setup task can run.

The backend itself is installed into a project-local conda environment at
`backend/.conda` from `backend/environment.yml`, then Python dependencies are
installed directly from `backend/pyproject.toml`.

## First-Time Setup

```bash
mise install
mise run setup
```

`mise run setup` installs backend and frontend dependencies and creates:

- `backend/.conda/` for the project-local backend Python environment
- `backend/data/` for SQLite, generated audio, and uploads
- `.cache/models/` for reusable model files and Hugging Face cache data

Downloaded model weights live outside the Python and Node dependency folders, so reinstalling dependencies or rebuilding containers does not redownload them.

To reset local runtime state without deleting downloaded models:

```bash
mise run clean
```

This removes `BANGERS_DATA_DIR` (`backend/data/` by default), then recreates fresh `audio/` and `uploads/` directories.

## Prepare Models

The backend starts with **no models loaded**. Open the **Models** page in the
running app and click Download / Select for the DiT (and optionally LM and chat
LLM) you want. Your selection is persisted in
`backend/data/conda-install-bangers.db` and auto-loaded on every restart.

The Models page is the only source of truth for which models are active — there
are no baked-in defaults and no env vars that pre-pick models for you.

## Run Locally

```bash
mise run dev
```

This runs the host-native launcher:

- backend: `https://localhost:8000` (FastAPI/uvicorn with TLS)
- frontend: `https://localhost:3000` (Next.js dev with `--experimental-https`)
- From another machine on the LAN/VPN: `https://<that-box's-hostname-or-ip>:3000`

Both servers share a single self-signed cert that the launcher mints into
`.cache/tls/`. The cert covers `localhost`, `127.0.0.1`,
and the box's detected LAN IP, so you can reach the dev server from another
device on the network without mismatched-hostname errors.

HTTPS is required everywhere because browsers only expose
`AudioContext.audioWorklet` (radio playback) in a "secure context" — i.e.
`https://…` or `http://localhost`. We picked HTTPS over the localhost
shortcut because we want LAN access from phones, other workstations, etc.
to also work without an SSH tunnel.

### Trusting the dev cert

The cert is self-signed and not in any system trust store, so browsers
warn about it the first time you connect. Click through ("Advanced →
Proceed to `<host>`") and the warning is remembered for that origin.

No `sudo`, no system-wide CA install, no `mkcert`. The cert/key pair lives
at `.cache/tls/dev.{pem,key.pem}` and is regenerated
automatically when it expires (default: 365 days) or when the LAN IP
changes between runs.

You can still run the launcher directly:

```bash
python start.py
python start.py --no-open
```

## Default Song Length

The app-wide song length is stored in backend settings as `default_duration`.
Change it from the UI at Settings -> Generation Defaults. Simple mode, Custom mode, DJ generation, and radio generation all read this setting.

## Cache and Data Paths

Default local paths:

```bash
BANGERS_DATA_DIR=./backend/data
BANGERS_MODEL_CACHE_DIR=./.cache/models
ACESTEP_PROJECT_ROOT=./.cache/models
HF_HOME=./.cache/models/huggingface
HF_HUB_CACHE=./.cache/models/huggingface/hub
```

Use a different disk by exporting paths before setup/dev:

```bash
export BANGERS_MODEL_CACHE_DIR=/Volumes/AI/models/conda-install-bangers
export ACESTEP_PROJECT_ROOT="$BANGERS_MODEL_CACHE_DIR"
export HF_HOME="$BANGERS_MODEL_CACHE_DIR/huggingface"
export HF_HUB_CACHE="$HF_HOME/hub"
mise run setup
mise run dev
```

## Tests

```bash
mise run test
```

This runs:

- backend: `cd backend && conda run --prefix .conda pytest -v`
- frontend: `pnpm --dir frontend exec vitest --run`

You can run each side manually:

```bash
cd backend && conda run --prefix .conda pytest -v
pnpm --dir frontend exec vitest --run
```

## Daily Workflow

Use `mise run dev` for application work. Docker is intended for production packaging and smoke testing, not for every code change.

If dependencies change:

```bash
mise run setup
```

If models appear to redownload, check that `BANGERS_MODEL_CACHE_DIR`, `ACESTEP_PROJECT_ROOT`, `HF_HOME`, and `HF_HUB_CACHE` all point at the same cache drive layout.

To warm the cache explicitly, open the **Models** page and click Download on the
models you want; downloads run in the background and persist across restarts.
