import { createRemoteJWKSet, jwtVerify } from 'jose';
import type { MiddlewareHandler } from 'hono';
import type { WorkerEnv } from './env.js';
import type { AuthenticatedUser, WorkerAppVariables } from './types.js';

type WorkerMiddleware = MiddlewareHandler<{
  Bindings: WorkerEnv;
  Variables: WorkerAppVariables;
}>;

const jwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

function getJwks(jwksUrl: string): ReturnType<typeof createRemoteJWKSet> {
  const existing = jwksCache.get(jwksUrl);
  if (existing) {
    return existing;
  }

  const jwks = createRemoteJWKSet(new URL(jwksUrl));
  jwksCache.set(jwksUrl, jwks);
  return jwks;
}

function createDevUser(): AuthenticatedUser {
  return {
    sub: 'dev-user',
    preferred_username: 'developer',
    realm_access: { roles: ['ADMIN', 'LANH_DAO', 'QUAN_LY', 'CHUYEN_VIEN', 'VAN_THU'] },
  };
}

async function tryAuthenticateBearerToken(
  env: WorkerEnv,
  token: string,
): Promise<AuthenticatedUser | null> {
  if (!env.KEYCLOAK_URL || !env.KEYCLOAK_REALM) {
    return null;
  }

  const issuer = `${env.KEYCLOAK_URL}/realms/${env.KEYCLOAK_REALM}`;
  const jwksUrl = `${issuer}/protocol/openid-connect/certs`;

  const { payload } = await jwtVerify(token, getJwks(jwksUrl), { issuer });
  return payload as unknown as AuthenticatedUser;
}

export const correlationIdMiddleware: WorkerMiddleware = async (c, next) => {
  const correlationId = c.req.header('x-correlation-id') ?? crypto.randomUUID();
  c.set('correlationId', correlationId);
  await next();
};

export const optionalAuth: WorkerMiddleware = async (c, next) => {
  const authHeader = c.req.header('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    if ((c.env.NODE_ENV ?? 'development') !== 'production') {
      c.set('user', createDevUser());
    }
    await next();
    return;
  }

  const token = authHeader.slice(7);
  try {
    const user = await tryAuthenticateBearerToken(c.env, token);
    if (user) {
      c.set('user', user);
    }
  } catch {
    // Intentionally continue unauthenticated for public endpoints.
  }

  await next();
};

export const requireAuth: WorkerMiddleware = async (c, next) => {
  const authHeader = c.req.header('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    if ((c.env.NODE_ENV ?? 'development') !== 'production') {
      c.set('user', createDevUser());
      await next();
      return;
    }

    return c.json({ error: 'Missing or invalid Authorization header' }, 401);
  }

  const token = authHeader.slice(7);
  try {
    const user = await tryAuthenticateBearerToken(c.env, token);
    if (!user) {
      return c.json({ error: 'Token verification failed' }, 401);
    }
    c.set('user', user);
    await next();
  } catch {
    return c.json({ error: 'Token verification failed' }, 401);
  }
};
