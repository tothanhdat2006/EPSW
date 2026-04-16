# DVC Workflow System

A high-throughput, AI-augmented document processing platform for Vietnamese public services (Dich vu Cong). The runtime architecture has been simplified to a unified Node Core API with BullMQ.

## Architecture

```
Citizen / Staff
      │
      ▼
apps/web-portal / apps/public-dvc-web
      │
      ▼
core-api (Node.js/TypeScript, Express)
      ├─ Documents API (submit, track, review, approve)
      ├─ HITL API (claim/resolve task)
      ├─ AI API (chat, re-analyze)
      ├─ Alibaba OCR + LLM adapters
      ├─ BullMQ workflows (document processing + SLA checks)
      ├─ Notification dispatch (email/SMS/Zalo)
      ├─ PostgreSQL (Prisma)
      └─ MinIO (raw/redacted/published files)
```

## Quick Start (Local)

### 1. Start Infrastructure
```bash
cd infra
docker compose up -d
```

If host ports conflict on your machine, override them inline, for example:

```bash
POSTGRES_PORT=5434 docker compose up -d
```

### 2. Initialize Keycloak Schema (Required once)
```bash
docker exec dvc-postgres psql -U dvc_user -d dvc_db -c "CREATE SCHEMA IF NOT EXISTS keycloak;"
```

### 3. Setup Database
```bash
# First time setup or if migrations diverge:
pnpm --filter @dvc/database exec prisma migrate reset --force

# Normal migration:
pnpm --filter @dvc/database db:migrate:dev
```

### 4. Configure Environment
Ensure you have a `.env` file in the root. Required keys now include `DATABASE_URL`, `REDIS_URL`, `LLM_API_KEY`, and MinIO credentials.

### 5. Running the System
Run this in one terminal:
- **Unified Stack**: `pnpm dev`

## Integrate External JSON Data into Web Portal (qwen-rag)

To load external datasets from:

- `/home/phuc/Project/qwen-rag/data.json`
- `/home/phuc/Project/qwen-rag/data_detail.json`

run the sync pipeline from the monorepo root:

```bash
pnpm sync:qwen-data
```

This copies and validates JSON into:

- `apps/web-portal/public/mock/qwen-data.json`
- `apps/web-portal/public/mock/qwen-data-detail.json`

Then start web portal in local JSON mode:

```bash
pnpm --filter @dvc/web-portal dev:mock
```

Or run sync + dev in one command:

```bash
pnpm dev:web-portal:mock
```

In mock mode, web-portal reads local files first and falls back to API only when needed.

## Services

| Service | Port | Tech |
|---|---|---|
| core-api | 3001 | Node.js/TypeScript (Express + BullMQ) |
| web-portal | 3000 | React/Vite |
| public-dvc-web | 3005 | React/Vite |

## Infrastructure

| Component | UI | Port |
|---|---|---|
| Redis | — | 6379 |
| PostgreSQL | — | 5433 |
| MinIO | Console | 9001 |
| Keycloak | Admin | 8180 |

## Environment Variables

Copy `infra/.env.example` to `.env` and fill in your values before running any service.

## HITL Rules

- AI Confidence Score **< 70** -> automatically paused and a HITL task is created.
- The system never auto-approves tasks that fail strict validation.
- SLA breach creates a manager escalation HITL task.

## Deployment (Kubernetes)

```bash
kubectl apply -f infra/kubernetes/namespace.yaml
kubectl apply -f infra/kubernetes/secrets/secrets.yaml  # fill in real values first
```

Legacy per-service Helm charts were removed as part of the unified runtime refactor. For Kubernetes deployment, create a dedicated `core-api` chart (or extend `infra/kubernetes/api-gateway` if you still use it as ingress).

## Troubleshooting

### 1. `ECONNREFUSED` on port 3001 (`/api/documents`)
- **Reason**: The `core-api` service is not running.
- **Fix**: Run `pnpm dev` in the root, or specifically start the service: `pnpm --filter @dvc/core-api dev`.

### 2. Prisma Migration Errors (Diverged data)
- **Reason**: The local database schema does not match the migration history.
- **Fix**: Run `pnpm --filter @dvc/database exec prisma migrate reset --force`. Note that this will clear all data.

### 3. Port Conflicts
- **Reason**: Another process is using mapped host ports (for example `5433`, `3001`, `3000`, `3005`).
- **Fix**: Stop the conflicting process or override compose ports (for example `POSTGRES_PORT=5434 docker compose up -d`).
