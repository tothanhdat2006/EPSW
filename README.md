# DVC Workflow System

A high-throughput, AI-augmented document processing platform for Vietnamese public services (Dịch vụ Công). Built as an Event-Driven Microservices monorepo.

## Architecture

```
Citizen / Staff
      │
      ▼
API Gateway (NGINX)
      │
      ├─► ingestion-service (Node.js/TS)   → Kafka: document.received
      │         └─ MinIO (raw file storage)
      │
Kafka ├─► document-parser-service (Python) → PyMuPDF + Tesseract OCR
      │         └─ Kafka: document.parsed | hitl.manual_entry_required
      │
      ├─► ai-agent-service (Python/LangChain)
      │         ├─ Classification (doc type, urgency, security level)
      │         ├─ Extraction (structured JSON)
      │         ├─ Redaction (PII removal → MinIO)
      │         └─ Confidence Gate: <70% → hitl.pending-topic
      │
      ├─► workflow-engine (Temporal.io/TS)
      │         ├─ Document state machine (RECEIVED→PUBLISHED)
      │         ├─ Dynamic SLA timers (FLASH:30m, URGENT:2h, NORMAL:48h)
      │         └─ Escalation on SLA breach → hitl.escalation
      │
      ├─► hitl-manager (Node.js/TS)
      │         ├─ Creates HitlTask records
      │         ├─ Keycloak ABAC role enforcement
      │         └─ REST API for claim/resolve tasks
      │
      └─► notification-service (Node.js/TS)
                ├─ Email (Nodemailer)
                ├─ SMS gateway
                ├─ Zalo OA API
                └─ LLM summary / rejection translation
```

## Quick Start (Local)

```bash
# 1. Start all infrastructure
cd infra
docker compose up -d

# 2. Run database migrations
pnpm --filter @dvc/database db:migrate:dev

# 3. Start all TypeScript services
pnpm install
pnpm dev

# 4. Start Python services (in separate terminals)
cd services/document-parser-service && pip install -r requirements.txt && uvicorn main:app --port 8001 --reload
cd services/ai-agent-service && pip install -r requirements.txt && uvicorn main:app --port 8002 --reload
```

## Services

| Service | Port | Tech |
|---|---|---|
| api-gateway | 80 | NGINX |
| ingestion-service | 3001 | Node.js/TypeScript |
| document-parser-service | 8001 | Python/FastAPI |
| ai-agent-service | 8002 | Python/FastAPI/LangChain |
| workflow-engine | — (worker) | TypeScript/Temporal.io |
| hitl-manager | 3003 | Node.js/TypeScript |
| notification-service | 3004 | Node.js/TypeScript |
| web-portal | 3000 | React/Vite |
| public-dvc-web | 3005 | React/Vite |

## Infrastructure

| Component | UI | Port |
|---|---|---|
| Kafka | Kafka UI | 8090 |
| PostgreSQL | — | 5432 |
| MinIO | Console | 9001 |
| Keycloak | Admin | 8080 |
| Temporal | Web UI | 8088 |

## Environment Variables

Copy `infra/.env.example` to `.env` and fill in your values before running any service.

## HITL Rules (from INSTRUCTIONS.md)

- AI Confidence Score **< 70** → automatically paused, event emitted to `hitl-pending-topic`
- The system **never auto-approves** tasks that fail the strict validation engine
- SLA breach → escalation event emitted to `hitl.escalation` for management intervention

## Deployment (Kubernetes)

```bash
kubectl apply -f infra/kubernetes/namespace.yaml
kubectl apply -f infra/kubernetes/secrets/secrets.yaml  # fill in real values first

helm install ingestion-service infra/kubernetes/ingestion-service -f infra/kubernetes/values.yaml
helm install document-parser-service infra/kubernetes/document-parser-service -f infra/kubernetes/values.yaml
helm install ai-agent-service infra/kubernetes/ai-agent-service -f infra/kubernetes/values.yaml
helm install workflow-engine infra/kubernetes/workflow-engine -f infra/kubernetes/values.yaml
helm install hitl-manager infra/kubernetes/hitl-manager -f infra/kubernetes/values.yaml
helm install notification-service infra/kubernetes/notification-service -f infra/kubernetes/values.yaml
helm install api-gateway infra/kubernetes/api-gateway -f infra/kubernetes/values.yaml
```
