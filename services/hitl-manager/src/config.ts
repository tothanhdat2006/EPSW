export const config = {
  port: parseInt(process.env['PORT'] ?? '3003', 10),
  nodeEnv: process.env['NODE_ENV'] ?? 'development',

  kafka: {
    brokers: (process.env['KAFKA_BROKERS'] ?? 'localhost:9092').split(','),
    clientId: process.env['KAFKA_CLIENT_ID'] ?? 'hitl-manager',
    groupId: process.env['KAFKA_GROUP_ID'] ?? 'hitl-manager-group',
  },

  keycloak: {
    url: process.env['KEYCLOAK_URL'] ?? 'http://localhost:8080',
    realm: process.env['KEYCLOAK_REALM'] ?? 'dvc',
    clientId: process.env['KEYCLOAK_CLIENT_ID'] ?? 'dvc-backend',
    clientSecret: process.env['KEYCLOAK_CLIENT_SECRET'] ?? '',
  },
} as const;
