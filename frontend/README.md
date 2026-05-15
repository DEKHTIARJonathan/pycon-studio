# conda install bangers frontend

Next.js 16 + React 19 frontend. The root launcher is the normal development path because it starts the backend and configures shared HTTPS.

## Root Launcher

From the repo root:

```bash
mise run dev
```

This serves the frontend at `https://localhost:3000`.

## Frontend Only

Use this only when the backend is already running separately:

```bash
pnpm install
pnpm dev
```

Standalone `pnpm dev` serves `http://localhost:3000`. The browser client infers the backend as `http://localhost:8000` unless you set a backend URL in Settings or provide `NEXT_PUBLIC_BANGERS_BACKEND_URL`.

## Test

```bash
pnpm exec vitest --run
```

## Build

```bash
pnpm build
```
