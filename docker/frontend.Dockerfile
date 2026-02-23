FROM node:20-bookworm-slim AS deps

ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:${PATH} \
    NEXT_TELEMETRY_DISABLED=1

RUN corepack enable && corepack prepare pnpm@9.15.9 --activate

WORKDIR /app/frontend

COPY frontend/package.json frontend/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM deps AS builder

ARG NEXT_PUBLIC_BANGERS_BACKEND_PORT=8000
ENV NEXT_PUBLIC_BANGERS_BACKEND_PORT=${NEXT_PUBLIC_BANGERS_BACKEND_PORT}

COPY frontend ./
RUN pnpm build

FROM node:20-bookworm-slim AS runner

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000

WORKDIR /app/frontend

COPY --from=builder /app/frontend/.next/standalone ./
COPY --from=builder /app/frontend/.next/static ./.next/static
COPY --from=builder /app/frontend/public ./public

EXPOSE 3000

CMD ["node", "server.js"]
