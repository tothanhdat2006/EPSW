import type { WorkerEnv } from './env.js';

type RedisCommandArg = string | number | boolean;

interface PipelineResult {
  result?: unknown;
  error?: string;
}

export class UpstashRedisClient {
  private readonly baseUrl: string;
  private readonly token: string;

  constructor(baseUrl: string, token: string) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.token = token;
  }

  private async run(command: string, ...args: RedisCommandArg[]): Promise<unknown> {
    const response = await fetch(`${this.baseUrl}/pipeline`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([[command, ...args.map((value) => String(value))]]),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Upstash command failed (${response.status}): ${text}`);
    }

    const payload = (await response.json()) as PipelineResult[];
    const first = payload[0];
    if (!first) {
      return undefined;
    }
    if (first.error) {
      throw new Error(`Upstash error: ${first.error}`);
    }
    return first.result;
  }

  async get(key: string): Promise<string | null> {
    const result = await this.run('GET', key);
    return typeof result === 'string' ? result : null;
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (ttlSeconds && ttlSeconds > 0) {
      await this.run('SET', key, value, 'EX', ttlSeconds);
      return;
    }
    await this.run('SET', key, value);
  }

  async setNxWithTtl(key: string, value: string, ttlSeconds: number): Promise<boolean> {
    const result = await this.run('SET', key, value, 'NX', 'EX', ttlSeconds);
    return result === 'OK';
  }

  async del(key: string): Promise<void> {
    await this.run('DEL', key);
  }
}

export function createUpstashClient(env: WorkerEnv): UpstashRedisClient | null {
  if (!env.UPSTASH_REDIS_REST_URL || !env.UPSTASH_REDIS_REST_TOKEN) {
    return null;
  }
  return new UpstashRedisClient(env.UPSTASH_REDIS_REST_URL, env.UPSTASH_REDIS_REST_TOKEN);
}
