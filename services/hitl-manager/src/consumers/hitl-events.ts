import { Kafka, Partitioners } from 'kafkajs';
import { prisma } from '@dvc/database';
import { KAFKA_TOPICS, HitlTaskType, HitlTaskStatus, AssignedRole } from '@dvc/shared-types';
import { createLogger, withCorrelation } from '@dvc/logger';
import { config } from '../config.js';
import { v4 as uuidv4 } from 'uuid';

const logger = createLogger({ service: 'hitl-manager' });

export async function startHitlConsumer(): Promise<void> {
  const kafka = new Kafka({ clientId: config.kafka.clientId, brokers: config.kafka.brokers });
  const consumer = kafka.consumer({ groupId: config.kafka.groupId });
  const producer = kafka.producer({ createPartitioner: Partitioners.DefaultPartitioner });

  await consumer.connect();
  await producer.connect();

  await consumer.subscribe({
    topics: [
      KAFKA_TOPICS.HITL_MANUAL_ENTRY_REQUIRED,
      KAFKA_TOPICS.HITL_REVIEW_REQUIRED,
      KAFKA_TOPICS.HITL_ESCALATION,
      KAFKA_TOPICS.HITL_PENDING,
    ],
    fromBeginning: false,
  });

  logger.info({ topics: [KAFKA_TOPICS.HITL_MANUAL_ENTRY_REQUIRED] }, 'HITL consumer started');

  await consumer.run({
    eachMessage: async ({ topic, message }) => {
      if (!message.value) return;

      const event = JSON.parse(message.value.toString());
      const correlationId: string = event.correlationId ?? uuidv4();
      const reqLogger = withCorrelation(logger, correlationId);
      const payload = event.payload ?? {};

      try {
        let taskType: string;
        let assignedRole: string;

        switch (topic) {
          case KAFKA_TOPICS.HITL_MANUAL_ENTRY_REQUIRED:
            taskType = HitlTaskType.OCR_FIX;
            assignedRole = payload.assignedRole ?? AssignedRole.VAN_THU;
            break;
          case KAFKA_TOPICS.HITL_REVIEW_REQUIRED:
          case KAFKA_TOPICS.HITL_PENDING:
            taskType = HitlTaskType.AI_REVIEW;
            assignedRole = payload.assignedRole ?? AssignedRole.CHUYEN_VIEN;
            break;
          case KAFKA_TOPICS.HITL_ESCALATION:
            taskType = HitlTaskType.MANAGER_ESCALATION;
            assignedRole = AssignedRole.QUAN_LY;
            break;
          default:
            taskType = HitlTaskType.AI_REVIEW;
            assignedRole = AssignedRole.CHUYEN_VIEN;
        }

        const existingTask = await prisma.hitlTask.findFirst({
          where: {
            documentId: payload.documentId,
            taskType,
            status: HitlTaskStatus.PENDING,
          },
        });

        if (!existingTask) {
          await prisma.hitlTask.create({
            data: {
              documentId: payload.documentId,
              taskType,
              assignedRole,
              status: HitlTaskStatus.PENDING,
            },
          });

          await prisma.document.update({
            where: { id: payload.documentId },
            data: { status: 'HITL_REVIEW' },
          });

          reqLogger.info(
            { documentId: payload.documentId, taskType, assignedRole },
            'HITL task created',
          );
        } else {
          reqLogger.info(
            { documentId: payload.documentId, taskType },
            'HITL task already exists, skipping duplicate',
          );
        }
      } catch (err) {
        reqLogger.error({ err, topic }, 'Failed to process HITL event');

        // Send to DLQ
        await producer.send({
          topic: `${topic}${KAFKA_TOPICS.DLQ_SUFFIX}`,
          messages: [
            {
              key: payload.documentId ?? 'unknown',
              value: JSON.stringify({ error: String(err), original: event }),
            },
          ],
        });
      }
    },
  });
}
