export const config = {
  port: parseInt(process.env['PORT'] ?? '3004', 10),
  nodeEnv: process.env['NODE_ENV'] ?? 'development',

  kafka: {
    brokers: (process.env['KAFKA_BROKERS'] ?? 'localhost:9092').split(','),
    clientId: process.env['KAFKA_CLIENT_ID'] ?? 'notification-service',
    groupId: process.env['KAFKA_GROUP_ID'] ?? 'notification-service-group',
  },

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
    apiUrl: 'https://openapi.zalo.me/v3.0/oa/message/cs',
  },

  llm: {
    model: process.env['LLM_MODEL'] ?? 'gpt-4o-mini',
    apiKey: process.env['OPENAI_API_KEY'] ?? '',
  },
} as const;
