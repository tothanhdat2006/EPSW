# Cloudflare Workers Setup (No Docker)

This setup runs EPSW core API on Cloudflare Workers with:

- Cloudflare D1 (SQL)
- Cloudflare R2 (object storage)
- Cloudflare Queues + Cron (workflow jobs + delayed SLA checks)
- Upstash Redis (metrics/event log)
- Better Auth (email/password credentials)

## 1) Prerequisites

- Cloudflare account + `wrangler` auth
- Upstash Redis database
- Node.js 20+
- pnpm 9+

```bash
pnpm install
pnpm --filter @dvc/core-api exec wrangler login
```

## 2) Create Cloudflare Resources

Run these once:

```bash
pnpm --filter @dvc/core-api exec wrangler d1 create epsw-core-db
pnpm --filter @dvc/core-api exec wrangler r2 bucket create epsw-documents
pnpm --filter @dvc/core-api exec wrangler r2 bucket create epsw-redacted
pnpm --filter @dvc/core-api exec wrangler r2 bucket create epsw-published
pnpm --filter @dvc/core-api exec wrangler queues create epsw-workflow
```

Update [services/core-api/wrangler.epsw.toml](../services/core-api/wrangler.epsw.toml) with the returned D1 `database_id`.

## 3) Configure Worker Secrets

Create local dev env file:

```bash
cp services/core-api/.dev.vars.example services/core-api/.dev.vars
```

Set remote secrets for production:

```bash
pnpm --filter @dvc/core-api exec wrangler secret put BETTER_AUTH_SECRET
pnpm --filter @dvc/core-api exec wrangler secret put UPSTASH_REDIS_REST_URL
pnpm --filter @dvc/core-api exec wrangler secret put UPSTASH_REDIS_REST_TOKEN
```

Set Better Auth runtime values in [services/core-api/wrangler.epsw.toml](../services/core-api/wrangler.epsw.toml):

- `BETTER_AUTH_URL`
- `BETTER_AUTH_TRUSTED_ORIGINS`

If you use direct Wrangler commands, pass the dedicated config file:

```bash
pnpm --filter @dvc/core-api exec wrangler --config wrangler.epsw.toml <command>
```

## 4) Apply D1 Schema

Local D1:

```bash
D1_DATABASE_NAME=epsw-core-db pnpm d1:schema:local
```

Remote D1:

```bash
D1_DATABASE_NAME=epsw-core-db pnpm d1:schema:remote
```

Schema source: [services/core-api/d1/schema.sql](../services/core-api/d1/schema.sql)

## 5) Run Local Worker Dev

```bash
pnpm dev:workers
```

Default endpoints:

- `GET /health`
- `GET|POST /api/auth/*` (better-auth)
- `POST /api/documents` (multipart file upload to R2)
- `GET /api/documents`
- `GET /api/documents/id/:id`
- `GET /api/documents/:trackingCode`
- `POST /api/documents/:documentId/approve`
- `GET /api/hitl/tasks`
- `POST /api/hitl/tasks/:taskId/claim`
- `POST /api/hitl/tasks/:taskId/resolve`
- `POST /api/ai/chat` (contextual response)
- `POST /api/ai/re-analyze`

## 6) Deploy

```bash
pnpm deploy:workers
```

## Notes

- This is the Docker-free runtime path. Existing Docker and Node server files are still present as legacy fallback while migration completes.
- BullMQ worker behavior has started moving to Cloudflare Queues + D1 scheduled jobs.
- SMTP delivery is not wired in Worker mode yet; notifications are currently tracked via Upstash event logs.
- Password hashing in Better Auth uses Web Crypto PBKDF2 (custom `emailAndPassword.password` config), not bcrypt.
- Detailed auth migration note: [AUTH_UPDATE_2026-04-16.md](./AUTH_UPDATE_2026-04-16.md)
