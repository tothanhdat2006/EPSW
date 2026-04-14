import { Request, Response, NextFunction } from 'express';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { config } from '../config.js';

const JWKS_URI = `${config.keycloak.url}/realms/${config.keycloak.realm}/protocol/openid-connect/certs`;
const JWKS = createRemoteJWKSet(new URL(JWKS_URI));

export interface AuthenticatedUser {
  sub: string;
  preferred_username?: string;
  email?: string;
  realm_access?: { roles: string[] };
  resource_access?: Record<string, { roles: string[] }>;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
      correlationId?: string;
    }
  }
}

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid Authorization header' });
    return;
  }

  const token = authHeader.slice(7);

  try {
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: `${config.keycloak.url}/realms/${config.keycloak.realm}`,
    });

    req.user = payload as unknown as AuthenticatedUser;
    next();
  } catch {
    res.status(401).json({ error: 'Token verification failed' });
  }
}

export function correlationIdMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  req.correlationId =
    (req.headers['x-correlation-id'] as string) ??
    crypto.randomUUID();
  next();
}
