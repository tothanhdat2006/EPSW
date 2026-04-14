export const config = {
  temporal: {
    address: process.env['TEMPORAL_ADDRESS'] ?? 'localhost:7233',
    namespace: process.env['TEMPORAL_NAMESPACE'] ?? 'default',
    taskQueue: process.env['TEMPORAL_TASK_QUEUE'] ?? 'dvc-workflow',
  },

  kafka: {
    brokers: (process.env['KAFKA_BROKERS'] ?? 'localhost:9092').split(','),
    clientId: process.env['KAFKA_CLIENT_ID'] ?? 'workflow-engine',
  },

  sla: {
    // SLA in milliseconds
    normalMs: 48 * 60 * 60 * 1000,
    urgentMs: 2 * 60 * 60 * 1000,
    flashMs: 30 * 60 * 1000,
  },
} as const;
