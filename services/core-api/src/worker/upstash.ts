import type { WorkerEnv } from './types.js';

function getUpstashConfig(env: WorkerEnv): { url: string; token: string } | null {
  if (!env.UPSTASH_REDIS_REST_URL || !env.UPSTASH_REDIS_REST_TOKEN) {
    return null;
  }

  return {
    url: env.UPSTASH_REDIS_REST_URL,
    token: env.UPSTASH_REDIS_REST_TOKEN,
  };
}

async function runPipeline(env: WorkerEnv, commands: string[][]): Promise<void> {
  const config = getUpstashConfig(env);
  if (!config) {
    return;
  }

  const response = await fetch(`${config.url}/pipeline`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(commands),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Upstash pipeline failed (${response.status}): ${message}`);
  }
}

export async function incrementMetric(env: WorkerEnv, metric: string, ttlSeconds = 86400): Promise<void> {
  try {
    await runPipeline(env, [
      ['INCR', metric],
      ['EXPIRE', metric, String(ttlSeconds)],
    ]);
  } catch {
    // Non-critical metrics should not fail requests.
  }
}

export async function pushNotificationLog(
  env: WorkerEnv,
  payload: Record<string, unknown>,
): Promise<void> {
  try {
    const serialized = JSON.stringify(payload);
    await runPipeline(env, [
      ['LPUSH', 'notifications:events', serialized],
      ['LTRIM', 'notifications:events', '0', '99'],
      ['EXPIRE', 'notifications:events', '2592000'],
    ]);
  } catch {
    // Non-critical logs should not fail requests.
  }
}
