import { Worker, NativeConnection } from '@temporalio/worker';
import { createLogger } from '@dvc/logger';
import { config } from './config.js';
import { startKafkaTrigger } from './kafka-trigger.js';
import * as slaActivities from './activities/sla.js';
import * as validationActivities from './activities/validation.js';
import * as notificationActivities from './activities/notification.js';

const logger = createLogger({ service: 'workflow-engine' });

async function main(): Promise<void> {
  logger.info({ address: config.temporal.address }, 'Connecting to Temporal');

  const connection = await NativeConnection.connect({
    address: config.temporal.address,
  });

  const worker = await Worker.create({
    connection,
    namespace: config.temporal.namespace,
    taskQueue: config.temporal.taskQueue,
    workflowsPath: new URL('./workflows/document-workflow.js', import.meta.url).pathname,
    activities: {
      ...slaActivities,
      ...validationActivities,
      ...notificationActivities,
    },
  });

  // Start the Kafka consumer that triggers new workflows
  startKafkaTrigger().catch((err) => {
    logger.error({ err }, 'Kafka trigger failed');
  });

  logger.info({ taskQueue: config.temporal.taskQueue }, 'Temporal worker started');
  await worker.run();
}

main().catch((err) => {
  logger.error({ err }, 'Worker crashed');
  process.exit(1);
});
