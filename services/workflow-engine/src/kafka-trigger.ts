import { Kafka } from 'kafkajs';
import { Connection, Client } from '@temporalio/client';
import { KAFKA_TOPICS } from '@dvc/shared-types';
import { createLogger, withCorrelation } from '@dvc/logger';
import { documentWorkflow } from './workflows/document-workflow.js';
import { config } from './config.js';
import { v4 as uuidv4 } from 'uuid';

const logger = createLogger({ service: 'workflow-engine' });

export async function startKafkaTrigger(): Promise<void> {
  const connection = await Connection.connect({ address: config.temporal.address });
  const client = new Client({ connection, namespace: config.temporal.namespace });

  const kafka = new Kafka({
    clientId: config.kafka.clientId,
    brokers: config.kafka.brokers,
  });

  const consumer = kafka.consumer({ groupId: 'workflow-engine-trigger' });
  await consumer.connect();
  await consumer.subscribe({
    topics: [KAFKA_TOPICS.DOCUMENT_ANALYZED, KAFKA_TOPICS.HITL_RESOLVED],
    fromBeginning: false,
  });

  logger.info({ topics: [KAFKA_TOPICS.DOCUMENT_ANALYZED] }, 'Workflow trigger consumer started');

  await consumer.run({
    eachMessage: async ({ topic, message }) => {
      if (!message.value) return;

      const event = JSON.parse(message.value.toString());
      const correlationId: string = event.correlationId ?? uuidv4();
      const reqLogger = withCorrelation(logger, correlationId);

      if (topic === KAFKA_TOPICS.DOCUMENT_ANALYZED) {
        const { documentId, trackingCode, extractedData, aiConfidence, priority } = event.payload;

        reqLogger.info({ documentId }, 'Starting document workflow');

        try {
          await client.workflow.start(documentWorkflow, {
            taskQueue: config.temporal.taskQueue,
            workflowId: `doc-workflow-${documentId}`,
            args: [
              {
                documentId,
                trackingCode,
                submitterId: event.payload.submitterId ?? 'unknown',
                priority: priority ?? 'NORMAL',
                extractedData: extractedData ?? {},
                correlationId,
              },
            ],
          });

          reqLogger.info({ documentId }, 'Workflow started successfully');
        } catch (err) {
          reqLogger.error({ err, documentId }, 'Failed to start workflow');
        }
      }

      if (topic === KAFKA_TOPICS.HITL_RESOLVED) {
        const { documentId, resolutionData } = event.payload;

        try {
          const handle = client.workflow.getHandle(`doc-workflow-${documentId}`);
          await handle.signal('hitlResolved', { resolutionData });
          reqLogger.info({ documentId }, 'HITL resolved signal sent to workflow');
        } catch (err) {
          reqLogger.error({ err, documentId }, 'Failed to signal workflow for HITL resolution');
        }
      }
    },
  });
}
