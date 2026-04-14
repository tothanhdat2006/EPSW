import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../services/keycloak.js';

declare global {
  namespace Express {
    interface Request {
      user?: {
        sub: string;
        preferred_username?: string;
        email?: string;
        realm_access?: { roles: string[] };
      };
      correlationId?: string;
    }
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing Authorization header' });
    return;
  }

  try {
    const user = await verifyToken(authHeader.slice(7));
    req.user = {
      sub: user.sub,
      preferred_username: user.preferred_username,
      email: user.email,
      realm_access: { roles: user.roles },
    };
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

export function correlationMiddleware(req: Request, _res: Response, next: NextFunction): void {
  req.correlationId = (req.headers['x-correlation-id'] as string) ?? crypto.randomUUID();
  next();
}
