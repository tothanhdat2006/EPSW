import type { WorkflowQueueMessage } from './types.js';

export interface WorkerEnv {
  DB: D1Database;
  R2_DOCUMENTS: R2Bucket;
  WORKFLOW_QUEUE: Queue<WorkflowQueueMessage>;

  NODE_ENV?: string;
  LOG_LEVEL?: string;

  KEYCLOAK_URL?: string;
  KEYCLOAK_REALM?: string;
  KEYCLOAK_CLIENT_ID?: string;

  LLM_PROVIDER?: string;
  LLM_MODEL?: string;
  LLM_API_KEY?: string;
  LLM_BASE_URL?: string;
  ALIBABA_OCR_API_URL?: string;
  ALIBABA_OCR_TIMEOUT_MS?: string;
  ALIBABA_OCR_MODEL?: string;
  LLM_TEMPERATURE?: string;

  CONFIDENCE_THRESHOLD?: string;
  MAX_FILE_SIZE_MB?: string;

  NOTIFICATION_WEBHOOK_URL?: string;

  UPSTASH_REDIS_REST_URL?: string;
  UPSTASH_REDIS_REST_TOKEN?: string;
}

export interface RuntimeConfig {
  nodeEnv: string;
  keycloak: {
    url?: string;
    realm: string;
    clientId: string;
  };
  llm: {
    provider: string;
    model: string;
    apiKey?: string;
    baseUrl?: string;
    ocrModel: string;
    temperature: number;
  };
  ocr: {
    endpoint?: string;
    timeoutMs: number;
  };
  confidenceThreshold: number;
  maxFileSizeBytes: number;
  notificationWebhookUrl?: string;
}

export const allowedMimeTypes = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/tiff',
] as const;

function parseNumber(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function getRuntimeConfig(env: WorkerEnv): RuntimeConfig {
  const provider = env.LLM_PROVIDER ?? 'alibaba';

  return {
    nodeEnv: env.NODE_ENV ?? 'development',
    keycloak: {
      url: env.KEYCLOAK_URL,
      realm: env.KEYCLOAK_REALM ?? 'dvc',
      clientId: env.KEYCLOAK_CLIENT_ID ?? 'dvc-backend',
    },
    llm: {
      provider,
      model: env.LLM_MODEL ?? 'qwen-plus',
      apiKey: env.LLM_API_KEY,
      baseUrl:
        env.LLM_BASE_URL ??
        (provider.toLowerCase() === 'openai'
          ? undefined
          : 'https://dashscope.aliyuncs.com/compatible-mode/v1'),
      ocrModel: env.ALIBABA_OCR_MODEL ?? 'qwen-vl-max-latest',
      temperature: parseNumber(env.LLM_TEMPERATURE, 0.2),
    },
    ocr: {
      endpoint: env.ALIBABA_OCR_API_URL,
      timeoutMs: parseNumber(env.ALIBABA_OCR_TIMEOUT_MS, 30000),
    },
    confidenceThreshold: parseNumber(env.CONFIDENCE_THRESHOLD, 70),
    maxFileSizeBytes: parseNumber(env.MAX_FILE_SIZE_MB, 50) * 1024 * 1024,
    notificationWebhookUrl: env.NOTIFICATION_WEBHOOK_URL,
  };
}
