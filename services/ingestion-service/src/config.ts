export const config = {
  port: parseInt(process.env['PORT'] ?? '3001', 10),
  nodeEnv: process.env['NODE_ENV'] ?? 'development',

  kafka: {
    brokers: (process.env['KAFKA_BROKERS'] ?? 'localhost:9092').split(','),
    clientId: process.env['KAFKA_CLIENT_ID'] ?? 'ingestion-service',
  },

  minio: {
    endPoint: process.env['MINIO_ENDPOINT'] ?? 'localhost',
    port: parseInt(process.env['MINIO_PORT'] ?? '9000', 10),
    useSSL: process.env['MINIO_USE_SSL'] === 'true',
    accessKey: process.env['MINIO_ACCESS_KEY'] ?? 'minio_admin',
    secretKey: process.env['MINIO_SECRET_KEY'] ?? 'minio_password',
    bucketDocuments: process.env['MINIO_BUCKET_DOCUMENTS'] ?? 'dvc-documents',
  },

  keycloak: {
    url: process.env['KEYCLOAK_URL'] ?? 'http://localhost:8080',
    realm: process.env['KEYCLOAK_REALM'] ?? 'dvc',
    clientId: process.env['KEYCLOAK_CLIENT_ID'] ?? 'dvc-backend',
  },

  maxFileSizeMb: parseInt(process.env['MAX_FILE_SIZE_MB'] ?? '50', 10),
  allowedMimeTypes: [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/tiff',
  ],
} as const;
