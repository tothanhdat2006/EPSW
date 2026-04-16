import { getAuth } from './better-auth.js';
import type { AuthenticatedUser, WorkerEnv } from './types.js';

function unauthorized(message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' },
  });
}

function toInternalUser(session: {
  user: {
    id: string;
    name?: string | null;
    email?: string | null;
    role?: string | null;
  };
}): AuthenticatedUser {
  const role = session.user.role ?? 'CITIZEN';

  return {
    sub: session.user.id,
    preferred_username: session.user.name ?? session.user.email ?? session.user.id,
    email: session.user.email ?? undefined,
    realm_access: {
      roles: [role],
    },
  };
}

async function getSessionUser(request: Request, env: WorkerEnv): Promise<AuthenticatedUser | null> {
  try {
    const auth = getAuth(env);
    const session = (await auth.api.getSession({
      headers: request.headers,
    })) as
      | {
          user?: {
            id: string;
            name?: string | null;
            email?: string | null;
            role?: string | null;
          };
        }
      | null;

    if (!session?.user?.id) {
      return null;
    }

    return toInternalUser({ user: session.user });
  } catch {
    return null;
  }
}

export async function authenticateRequest(
  request: Request,
  env: WorkerEnv,
  options: { required: boolean },
): Promise<AuthenticatedUser | null | Response> {
  const sessionUser = await getSessionUser(request, env);
  if (sessionUser) {
    return sessionUser;
  }

  if (env.NODE_ENV === 'development') {
    return {
      sub: 'dev-user',
      preferred_username: 'developer',
      realm_access: { roles: ['ADMIN', 'LANH_DAO', 'QUAN_LY', 'CHUYEN_VIEN', 'VAN_THU'] },
    };
  }

  if (options.required) {
    return unauthorized('Authentication required');
  }

  return null;
}
