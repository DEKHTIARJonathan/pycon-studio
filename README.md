<div align="center">

<h1>conda install bangers</h1>

**Local-first AI music generation studio**

![Windows](https://img.shields.io/badge/Windows-0078D6?style=flat-square)
![macOS](https://img.shields.io/badge/macOS-000000?style=flat-square)
![Linux](https://img.shields.io/badge/Linux-FCC624?style=flat-square)
![Python](https://img.shields.io/badge/Python-3.11+-blue?style=flat-square)
![Next.js](https://img.shields.io/badge/Next.js-16-black?style=flat-square)
![FastAPI](https://img.shields.io/badge/FastAPI-0.110+-009688?style=flat-square)
![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square)
![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)
![ACE-Step](https://img.shields.io/badge/ACE--Step-1.5-purple?style=flat-square)

Generate, remix, and manage AI music entirely on your own machine.
Built on [ACE-Step 1.5](https://github.com/ace-step/ACE-Step-1.5).

[Features](#features) · [Screenshots](#screenshots) · [Quick Start](#quick-start) · [Development](DEVELOPMENT.md) · [Deployment](DEPLOY.md) · [Configuration](#configuration) · [Credits](#credits--license)

</div>

## Screenshots

<table>
<tr>
<td align="center"><strong>Create</strong></td>
<td align="center"><strong>Models</strong></td>
</tr>
<tr>
<td><img src="screenshots/create.png" alt="Create page — generate music from text" width="100%"></td>
<td><img src="screenshots/models.png" alt="Models page — download and manage models" width="100%"></td>
</tr>
<tr>
<td align="center"><sub>Generate music from text or full custom parameters</sub></td>
<td align="center"><sub>One-click model downloads and management</sub></td>
</tr>
</table>

## Features

### Music Generation

- **Text-to-Music (Simple Mode)** — describe what you want, get a song
- **Custom Mode** — full control over caption, lyrics, BPM, key, and time signature
- **Remix (Cover)** — upload or pick an existing song, transform it with AI
- **AutoGen** — automatic batch generation with optional auto-save

### AI DJ

- **Conversational music generation** — chat naturally to describe what you want to hear
- **Local chat LLMs** — runs MLX-quantized models on Apple Silicon and Transformers models elsewhere; the runtime is auto-selected from the model you pick
- **Conversation history** — pick up where you left off with saved chat sessions
- **Auto-titling** — conversations are automatically named based on content

### Radio

- **Jukebox mode** — continuous, hands-free music generation
- **Station presets & custom stations** — create stations with specific genres, moods, and parameters
- **Radio ambiance** — vinyl crackle, static, and brown noise effects for that analog feel

### Library & Player

- **Library** — browse, search, filter, rate, and organize your generated music
- **Full Audio Player** — mini-player, full-screen overlay, queue, keyboard shortcuts

### Models

- **Model management** — one-click downloads, model switching, and status tracking from the Models page

### Customization

- **conda install bangers identity** — Long Beach night colors with cyan, pink, yellow, and maximum music energy
- **GPU throttle tuning** — some tricks to minimize audio stuttering on Apple Silicon unified memory during continous generation

## Quick Start

### Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Python | 3.10+ launcher; backend uses conda Python 3.11 | [python.org](https://www.python.org/downloads/) |
| conda | latest | `mise install`, [Miniforge](https://conda-forge.org/download/), or [Miniconda](https://docs.conda.io/projects/miniconda/) |
| Node.js | 20+ | [nodejs.org](https://nodejs.org/) |
| pnpm | 9+ | [pnpm.io](https://pnpm.io/installation) |

### Clone & Run

```bash
git clone https://github.com/DEKHTIARJonathan/conda-install-bangers.git
cd conda-install-bangers
mise run setup
mise run dev
```

That's it. The launcher:
- Checks prerequisites (Python, conda, Node.js, pnpm)
- Installs dependencies automatically on first run
- Starts the backend (port 8000) and frontend (port 3000)
- Opens your browser automatically once ready

On first launch the app starts with **no models loaded**. Open the **Models** page in
your browser to download and select the DiT model, language model, and chat LLM you
want; your selection is persisted in the database and reloaded automatically on
every restart.

Make sure you have plenty of free disk space — model weights typically range from
1 GB to 50 GB depending on what you pick.

Press `Ctrl+C` to stop both servers.

### Development with mise

For daily development without rebuilding containers:

```bash
mise install
mise run setup
mise run dev
mise run test
# Reset local DB/audio/uploads while keeping downloaded models:
mise run clean
```

See [DEVELOPMENT.md](DEVELOPMENT.md) for local workflow, cache layout, and troubleshooting.

The repo enables mise's experimental conda backend in `.mise.toml` so `mise install`
can install `conda` without a separate global `mise settings experimental=true`.
The tool entry must use the backend-qualified form `"conda:conda" = "latest"`;
bare `conda = "latest"` is resolved as a normal mise registry tool on some
versions and fails with `conda not found in mise tool registry`.

### Production with Docker Compose

For an NVIDIA Linux production host:

```bash
cp .env.example .env
docker compose build
docker compose up -d
```

See [DEPLOY.md](DEPLOY.md) for GPU prerequisites, persistent volumes, upgrades, backups, and reverse proxy notes.

### Models & Hardware

All models are downloaded and selected from the **Models** page. The app starts with
no models loaded — pick whichever DiT (and optionally LM) fits your hardware and
your selection persists across restarts.

**DiT models** — turbo (recommended), turbo-shift1, turbo-shift3, turbo-continuous, sft (50-step), base (50-step)

**Language models** — 1.7B, 0.6B (lightweight), 4B (best quality), or no LM at all

Rough LM guidance by VRAM:

| VRAM | Suggested LM | Notes |
|------|--------------|-------|
| ≤6 GB | none | DiT-only, no lyrics formatting |
| 6-8 GB | 0.6B | Lightweight, separate download |
| 8-16 GB | 1.7B | Full features |
| 16-24 GB | 1.7B or 4B | Best quality with 4B |
| ≥24 GB | 4B | Maximum quality |

### Flags

```bash
python3 start.py --install   # Force reinstall all dependencies
python3 start.py --no-open   # Don't auto-open browser
```

### Updating

```bash
git pull
python3 start.py        # macOS / Linux
python start.py         # Windows
```

The launcher automatically detects dependency changes after `git pull` and reinstalls as needed — including CUDA PyTorch on Windows.

To force a full reinstall: `python3 start.py --install`

<details>
<summary><strong>Manual Setup</strong></summary>

If you prefer to run things separately:

```bash
# Backend
cd backend
conda env create --prefix .conda --file environment.yml
conda run --prefix .conda python -m pip install --prefer-binary --extra-index-url https://download.pytorch.org/whl/cu130 -e '.[dev]'
conda run --prefix .conda conda-install-bangers  # Starts on :8000

# Frontend (separate terminal)
cd frontend
pnpm install
pnpm dev                     # Starts on :3000
```

</details>

## Configuration

Environment variables (all optional, sensible defaults provided):

| Variable | Default | Description |
|----------|---------|-------------|
| `BANGERS_HOST` | `0.0.0.0` | Backend bind address |
| `BANGERS_PORT` | `8000` | Backend port |
| `BANGERS_DEVICE` | `auto` | GPU device (`auto`, `cuda`, `mps`, `cpu`) |
| `BANGERS_LM_BACKEND` | `mlx` on macOS, `nano-vllm` on Linux | LM backend |
| `BANGERS_AUDIO_FORMAT` | `flac` | Default output format |
| `BANGERS_BATCH_SIZE` | `2` | Number of samples per generation batch |
| `BANGERS_INFERENCE_STEPS` | `8` | Default DiT inference steps |
| `BANGERS_GUIDANCE_SCALE` | `7.0` | Default DiT guidance scale |
| `BANGERS_THINKING` | `true` | Default 5Hz LM thinking mode |
| `BANGERS_DATA_DIR` | `backend/data` | Runtime data directory for DB, audio, uploads, and datasets |
| `BANGERS_MODEL_CACHE_DIR` | `.cache/models` | Persistent model/cache directory |
| `ACESTEP_PROJECT_ROOT` | `.cache/models` | Root model directory for checkpoints and chat LLMs |
| `BANGERS_DISTRIBUTED_ROLE` | `standalone` | `standalone`, `coordinator`, or `worker` |
| `BANGERS_NODE_ID` | hostname | Human-readable node name reported to coordinators |
| `BANGERS_WORKERS` | empty | Comma-separated worker backend URLs used by a coordinator |
| `BANGERS_WORKER_CAPABILITIES` | all on standalone/worker, empty on coordinator | Comma-separated local capabilities: `music`, `ace_lm`, `chat_llm` |
| `BANGERS_WORKER_TOKEN` | empty | Optional shared token for coordinator-to-worker requests |
| `BANGERS_WORKER_TIMEOUT_SECONDS` | `900` | Coordinator HTTP timeout for long worker jobs |

### Two DGX Spark Inference Split

Run one backend as the coordinator and one backend per worker. A practical two-node split is:

```bash
# Coordinator/UI node
BANGERS_DISTRIBUTED_ROLE=coordinator
BANGERS_WORKERS=http://spark-music:8000,http://spark-llm:8000
BANGERS_WORKER_TOKEN=change-me

# Spark A: ACE-Step DiT/VAE music worker
BANGERS_DISTRIBUTED_ROLE=worker
BANGERS_NODE_ID=spark-music
BANGERS_WORKER_CAPABILITIES=music
BANGERS_WORKER_TOKEN=change-me

# Spark B: ACE 5Hz LM plus app chat/title/lyrics worker
BANGERS_DISTRIBUTED_ROLE=worker
BANGERS_NODE_ID=spark-llm
BANGERS_WORKER_CAPABILITIES=ace_lm,chat_llm
BANGERS_WORKER_TOKEN=change-me
```

The coordinator keeps the UI, database, history, uploads, and copied audio artifacts. Workers expose internal APIs under `/api/internal/worker/*`; use the shared token on any non-private LAN.

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Space` | Play / Pause |
| `N` / `P` | Next / Previous track |
| `M` | Mute / Unmute |
| `E` | Expand / Collapse full player |
| `F` | Toggle favorite |
| `1`–`5` | Set rating |
| `←` / `→` | Seek backward / forward |

## Project Structure

```
conda-install-bangers/
├── start.py                  # One-command launcher
├── compose.yaml              # Production Docker Compose stack
├── docker/                   # Backend and frontend Dockerfiles
├── DEVELOPMENT.md            # Local development workflow
├── DEPLOY.md                 # Production deployment workflow
├── backend/                  # Python — FastAPI + SQLite + ACE-Step
│   ├── src/bangers/
│   │   ├── main.py           # App entry, CORS, routers
│   │   ├── config.py         # Environment settings
│   │   ├── ace_handler.py    # BangersHandler (checkpoint resolution)
│   │   ├── backends/         # ACE-Step music generation backend
│   │   ├── db/               # SQLite schema, connection, indexes
│   │   ├── routers/          # REST + WebSocket endpoints
│   │   │   ├── generation.py # Music generation
│   │   │   ├── dj.py         # AI DJ chat
│   │   │   ├── radio.py      # Radio stations
│   │   │   └── ...           # Songs, models, uploads, history, etc.
│   │   ├── services/         # Generation, DJ, radio, chat-LLM runtime
│   │   ├── models/           # Pydantic request/response schemas
│   │   └── ws/               # WebSocket handlers
│   ├── data/                 # Runtime data (gitignored)
│   │   ├── audio/            # Generated music files
│   │   └── uploads/          # Uploaded source audio
│   └── tests/                # pytest + httpx
├── .cache/models/    # Persistent model cache (gitignored)
│   ├── checkpoints/          # ACE-Step model weights
│   ├── chat-llm/             # Local chat LLM weights
├── frontend/                 # TypeScript — Next.js + React 19
│   └── src/
│       ├── app/              # Page routes (create, dj, radio, library, etc.)
│       ├── components/       # UI components by feature
│       │   ├── create/       # Music generation forms
│       │   ├── dj/           # AI DJ chat interface
│       │   ├── radio/        # Radio station player
│       │   ├── settings/     # Settings
│       │   └── ...           # Library, models, layout
│       ├── hooks/            # Custom React hooks
│       ├── stores/           # Zustand state management
│       ├── themes/           # bangers theme tokens
│       ├── lib/              # API client, utilities, audio helpers
│       └── types/            # TypeScript interfaces
├── screenshots/              # README screenshots
└── LICENSE
```

## Tech Stack

<table>
<tr>
<td valign="top"><strong>Backend</strong></td>
<td valign="top"><strong>Frontend</strong></td>
</tr>
<tr>
<td valign="top">

- [FastAPI](https://fastapi.tiangolo.com/) — async API
- [SQLite](https://www.sqlite.org/) — WAL mode, optimized
- [ACE-Step 1.5](https://github.com/ace-step/ACE-Step-1.5) — music generation
- [uvicorn](https://www.uvicorn.org/) — ASGI server

</td>
<td valign="top">

- [Next.js 16](https://nextjs.org/) — React framework
- [React 19](https://react.dev/) — UI library
- [Tailwind CSS v4](https://tailwindcss.com/) — styling
- [Radix UI](https://www.radix-ui.com/) — accessible components
- [Zustand](https://zustand-demo.pmnd.rs/) — state management
- [TanStack Query](https://tanstack.com/query) — data fetching
- [WaveSurfer.js](https://wavesurfer.xyz/) — audio visualization
- [Motion](https://motion.dev/) — animations

</td>
</tr>
</table>

## Running Tests

```bash
mise run test
```

Or run each side directly:

```bash
# Backend
cd backend && conda run --prefix .conda pytest -v

# Frontend
cd frontend && pnpm exec vitest --run
```

## Credits & License

conda install bangers is built on top of [ACE-Step 1.5](https://github.com/ace-step/ACE-Step-1.5).

Community inspirations:
- **AI DJ** — inspired by [clockworksquirrel/ace-step-apple-silicon](https://github.com/clockworksquirrel/ace-step-apple-silicon)
- **Radio** — inspired by [nalexand/ACE-Step-1.5-OPTIMIZED](https://github.com/nalexand/ACE-Step-1.5-OPTIMIZED) and [PasiKoodaa/ACE-Step-RADIO](https://github.com/PasiKoodaa/ACE-Step-RADIO)

Licensed under the [MIT License](LICENSE).
