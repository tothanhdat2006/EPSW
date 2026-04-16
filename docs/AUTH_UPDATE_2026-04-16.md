# Auth Update: Better Auth + Web Crypto (2026-04-16)

This note documents the authentication update for the Cloudflare Worker runtime in `@dvc/core-api`.

## Scope

- Runtime path: `services/core-api/src/worker.ts`
- Auth modules:
  - `services/core-api/src/worker/better-auth.ts`
  - `services/core-api/src/worker/auth.ts`
  - `services/core-api/src/worker/password.ts`
- D1 schema:
  - `services/core-api/d1/schema.sql`
- Worker config:
  - `services/core-api/wrangler.epsw.toml`
  - `services/core-api/.dev.vars.example`

## What Changed

1. Worker auth switched from Keycloak bearer-token validation to Better Auth session-based credentials auth.
2. Email/password flows are now handled through Better Auth at `GET|POST /api/auth/*`.
3. Password hashing now uses Web Crypto (`crypto.subtle`) PBKDF2-SHA256 in `password.ts`.
4. bcrypt is not used in the Worker auth flow.
5. D1 now includes Better Auth core tables: `user`, `session`, `account`, `verification`.
6. User role is stored as an additional Better Auth user field with default `CITIZEN`.

## Password Hashing Details

The Worker uses a custom password provider for Better Auth:

- Algorithm: `PBKDF2` with `SHA-256`
- Iterations: `210000`
- Salt length: `16` bytes
- Output length: `32` bytes
- Storage format: `pbkdf2_sha256$<iterations>$<salt_b64url>$<digest_b64url>`

Verification uses the same PBKDF2 parameters and a constant-time byte comparison.

## Required Environment Variables

- `BETTER_AUTH_SECRET` (required in production, at least 32 chars)
- `BETTER_AUTH_URL` (base URL for auth endpoints)
- `BETTER_AUTH_TRUSTED_ORIGINS` (comma-separated allowed origins)

Optional but recommended:

- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

Note: Upstash Redis is optional in this runtime and is used for metrics/event tracking. Auth/session persistence is backed by D1.

## D1 Migration Steps

Apply schema changes to ensure Better Auth tables exist:

```bash
# local
D1_DATABASE_NAME=epsw-core-db pnpm --filter @dvc/core-api d1:schema:local

# remote
D1_DATABASE_NAME=epsw-core-db pnpm --filter @dvc/core-api d1:schema:remote
```

## Auth Endpoints (Better Auth)

Mounted at `GET|POST /api/auth/*` through `getAuth(env).handler(request)`.

Common credential endpoints:

- `POST /api/auth/sign-up/email`
- `POST /api/auth/sign-in/email`
- `POST /api/auth/sign-out`
- `GET /api/auth/get-session`

Protected Worker routes resolve the user from Better Auth session cookies via `auth.api.getSession(...)`.

## Smoke Test Checklist

1. Start Worker dev:

```bash
pnpm --filter @dvc/core-api dev:workers
```

2. Sign up a test user via Better Auth endpoint.
3. Sign in and confirm session cookie is returned.
4. Call protected endpoint (`/api/hitl/tasks`) with session cookie.
5. Verify unauthorized response without session in production mode.

## Known Compatibility Note

There are two Worker codepaths in the repository (`src/worker.ts` and `worker/src/index.ts`).

This update applies to the canonical path configured in `wrangler.epsw.toml`:

- `main = "src/worker.ts"`

If you continue migrating the alternate scaffold, keep auth behavior consistent with this document.