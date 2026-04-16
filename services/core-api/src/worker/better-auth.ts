import { betterAuth } from 'better-auth';
import { hashPassword, verifyPassword } from './password.js';
import type { WorkerEnv } from './types.js';

let cachedAuth: ReturnType<typeof betterAuth> | null = null;
let cachedKey = '';

function parseTrustedOrigins(input: string | undefined): string[] {
  if (!input) {
    return [];
  }

  return input
    .split(',')
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
}

function getAuthSecret(env: WorkerEnv): string {
  if (env.BETTER_AUTH_SECRET && env.BETTER_AUTH_SECRET.length >= 32) {
    return env.BETTER_AUTH_SECRET;
  }

  if ((env.NODE_ENV ?? 'development') !== 'production') {
    return 'dev-only-better-auth-secret-change-in-production-32chars';
  }

  throw new Error('BETTER_AUTH_SECRET must be configured and at least 32 characters long');
}

function getAuthCacheKey(env: WorkerEnv): string {
  return [
    getAuthSecret(env),
    env.BETTER_AUTH_URL ?? '',
    env.BETTER_AUTH_TRUSTED_ORIGINS ?? '',
  ].join('||');
}

export function getAuth(env: WorkerEnv): ReturnType<typeof betterAuth> {
  const cacheKey = getAuthCacheKey(env);
  if (cachedAuth && cachedKey === cacheKey) {
    return cachedAuth;
  }

  const baseURL = env.BETTER_AUTH_URL ?? 'http://localhost:8787';
  const trustedOrigins = parseTrustedOrigins(env.BETTER_AUTH_TRUSTED_ORIGINS);

  cachedAuth = betterAuth({
    secret: getAuthSecret(env),
    baseURL,
    trustedOrigins,
    database: env.DB,
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
      maxPasswordLength: 128,
      password: {
        hash: hashPassword,
        verify: verifyPassword,
      },
    },
    user: {
      additionalFields: {
        role: {
          type: 'string',
          required: false,
          defaultValue: 'CITIZEN',
          input: false,
        },
      },
    },
    advanced: {
      database: {
        generateId: () => crypto.randomUUID(),
      },
    },
  });

  cachedKey = cacheKey;
  return cachedAuth;
}
