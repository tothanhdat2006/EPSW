export const config = {
  port: parseInt(process.env['PORT'] ?? '3001', 10),
  nodeEnv: process.env['NODE_ENV'] ?? 'development',

  keycloak: {
    url: process.env['KEYCLOAK_URL'] ?? 'http://localhost:8080',
    realm: process.env['KEYCLOAK_REALM'] ?? 'dvc',
    clientId: process.env['KEYCLOAK_CLIENT_ID'] ?? 'dvc-backend',
  },

  minio: {
    endPoint: process.env['MINIO_ENDPOINT'] ?? 'localhost',
    port: parseInt(process.env['MINIO_PORT'] ?? '9000', 10),
    useSSL: process.env['MINIO_USE_SSL'] === 'true',
    accessKey: process.env['MINIO_ACCESS_KEY'] ?? 'minio_admin',
    secretKey: process.env['MINIO_SECRET_KEY'] ?? 'minio_password',
    bucketDocuments: process.env['MINIO_BUCKET_DOCUMENTS'] ?? 'dvc-documents',
    bucketRedacted: process.env['MINIO_BUCKET_REDACTED'] ?? 'dvc-redacted',
    bucketPublished: process.env['MINIO_BUCKET_PUBLISHED'] ?? 'dvc-published',
  },

  redis: {
    url: process.env['REDIS_URL'] ?? 'redis://localhost:6379',
  },

  llm: {
    provider: process.env['LLM_PROVIDER'] ?? 'alibaba',
    model: process.env['LLM_MODEL'] ?? 'qwen-plus',
    apiKey: process.env['LLM_API_KEY'] ?? process.env['OPENAI_API_KEY'] ?? '',
    baseUrl:
      process.env['LLM_BASE_URL'] ??
      ((process.env['LLM_PROVIDER'] ?? '').toLowerCase() === 'openai'
        ? undefined
        : 'https://dashscope.aliyuncs.com/compatible-mode/v1'),
    ocrModel: process.env['ALIBABA_OCR_MODEL'] ?? 'qwen-vl-max-latest',
    temperature: parseFloat(process.env['LLM_TEMPERATURE'] ?? '0.2'),
  },

  ocr: {
    endpoint: process.env['ALIBABA_OCR_API_URL'] ?? '',
    timeoutMs: parseInt(process.env['ALIBABA_OCR_TIMEOUT_MS'] ?? '30000', 10),
  },

  confidenceThreshold: parseFloat(process.env['CONFIDENCE_THRESHOLD'] ?? '70'),

  smtp: {
    host: process.env['SMTP_HOST'] ?? 'smtp.example.com',
    port: parseInt(process.env['SMTP_PORT'] ?? '587', 10),
    user: process.env['SMTP_USER'] ?? '',
    pass: process.env['SMTP_PASS'] ?? '',
    from: process.env['SMTP_FROM'] ?? 'noreply@dvc.gov.vn',
  },

  sms: {
    gatewayUrl: process.env['SMS_GATEWAY_URL'] ?? 'https://sms.example.com/api/send',
    apiKey: process.env['SMS_API_KEY'] ?? '',
  },

  zalo: {
    oaAccessToken: process.env['ZALO_OA_ACCESS_TOKEN'] ?? '',
    apiUrl: process.env['ZALO_API_URL'] ?? 'https://openapi.zalo.me/v3.0/oa/message/cs',
  },

  maxFileSizeMb: parseInt(process.env['MAX_FILE_SIZE_MB'] ?? '50', 10),
  allowedMimeTypes: [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/tiff',
  ],
} as const;
