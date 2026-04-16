# DVC AI Enterprise

Hệ thống quản trị và xử lý thủ tục hành chính công (Dịch vụ Công - DVC), được tăng cường sức mạnh bởi AI (Qwen) với khả năng tự động bóc tách OCR+LLM và định tuyến quy trình nghiệp vụ.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | SvelteKit (Svelte 5), Shadcn-Svelte, Tailwind CSS V4 |
| API / Runtime | Cloudflare Workers (via `@sveltejs/adapter-cloudflare`) |
| Database | Cloudflare D1 (SQLite) + Drizzle ORM |
| File Storage | Cloudflare R2 |
| Caching | Upstash Redis |
| AI Engine | Alibaba DashScope — Qwen models (OCR + LLM) |
| Auth | Better Auth (email/password, session via D1) |
| Fonts | Space Grotesk, Outfit, JetBrains Mono |

## Local Development Setup

### 1. Install dependencies

```bash
cd app
pnpm install
```

### 2. Configure environment variables

Create `app/.env` with the following:

```env
# Cloudflare (required only for remote DB push / production deploy)
CLOUDFLARE_ACCOUNT_ID=""
CLOUDFLARE_DATABASE_ID=""
CLOUDFLARE_D1_TOKEN=""

# Upstash Redis
UPSTASH_REDIS_REST_URL=""
UPSTASH_REDIS_REST_TOKEN=""

# Cloudflare R2 (S3-compatible)
R2_ACCESS_KEY_ID=""
R2_SECRET_ACCESS_KEY=""
R2_TOKEN_VALUE=""

# AI: Alibaba DashScope / Qwen (OpenAI-compatible)
LLM_PROVIDER="dashscope"
LLM_API_KEY="sk-xxxxxxxxxxxxxxxx"
LLM_BASE_URL="https://dashscope.aliyuncs.com/compatible-mode/v1"

# Better Auth
BETTER_AUTH_SECRET="your-random-secret-here"
ORIGIN="http://localhost:5173"
```

### 3. Generate auth schema (one-time)

Better Auth needs to generate the user/session/account table definitions:

```bash
cd app
pnpm auth:schema
```

This writes `src/lib/server/db/auth.schema.ts`. The file is already exported from `schema.ts`.

### 4. Start the dev server

```bash
cd app
pnpm dev
```

On every start, the dev script automatically runs:
```
wrangler d1 execute epsw-db --local --file=scripts/schema-local.sql
```
This creates all D1 tables (idempotent — safe to run repeatedly) in Wrangler's **local** Miniflare D1 simulation before Vite boots.

> **Note**: Local dev uses a local SQLite file at `.wrangler/state/v3/d1/`. This is separate from your remote Cloudflare D1 database. No Cloudflare credentials are needed for local development.

### 5. Create the admin account (one-time)

After the dev server is running, seed the default admin account:

```bash
curl -X POST http://localhost:5173/api/auth/sign-up/email \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@dvc.gov.vn","password":"Admin@DVC2025!","name":"Quản trị viên DVC"}'
```

Expected response: `HTTP 200` with a user object.

**Default credentials:**
| | |
|---|---|
| Email | `admin@dvc.gov.vn` |
| Password | `Admin@DVC2025!` |

> ⚠️ Change this password after first login.

### 6. Access the application

| Route | Description |
|---|---|
| `http://localhost:5173/` | Citizen portal — submit documents |
| `http://localhost:5173/track` | Track document status by code |
| `http://localhost:5173/portal/login` | Staff login |
| `http://localhost:5173/portal` | Admin dashboard (requires login) |

---

## Commands Reference

```bash
# Development
pnpm dev              # Push local schema + start Vite dev server
pnpm check            # Svelte type-check + wrangler types sync

# Database
pnpm db:push          # Push schema to REMOTE Cloudflare D1 (requires env vars)
pnpm auth:schema      # Regenerate Better Auth table definitions

# Admin
pnpm seed:admin       # Create admin account (run while dev server is up)

# Production
pnpm build            # Build for Cloudflare Workers
pnpm preview          # Preview production build locally
```

---

## Production Deployment

```bash
cd app

# 1. Push schema to remote D1 (requires CLOUDFLARE_D1_TOKEN in .env)
pnpm db:push

# 2. Build and deploy to Cloudflare Pages/Workers
pnpm build
npx wrangler deploy
```

---

## AI + HITL Flow

Documents submitted by citizens are processed automatically:

1. File uploaded → stored in **Cloudflare R2**
2. **Qwen OCR** extracts text and structured fields
3. If AI confidence < 70%, SLA is breached, or validation fails → document is **paused** and a task is created in the **HITL Queue**
4. Staff claim and resolve tasks from `/portal/hitl`
5. Once validated → routed to leadership approval at `/portal/approval`

---

## Architecture Diagram

```
Citizen / Staff Browser
        │
        ▼
   SvelteKit (Cloudflare Workers)
        │
        ├─ Cloudflare D1 (SQL via Drizzle ORM)
        ├─ Cloudflare R2 (file storage)
        ├─ Upstash Redis (caching / rate limiting)
        └─ DashScope API (Qwen OCR + LLM)
```
