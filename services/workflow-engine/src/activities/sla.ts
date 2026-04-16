import { Context } from '@temporalio/activity';
import { prisma } from '@dvc/database';
import { createLogger, withCorrelation } from '@dvc/logger';
import { KAFKA_TOPICS, Priority, type HitlEscalationEvent } from '@dvc/shared-types';
import { Kafka, Partitioners } from 'kafkajs';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config.js';

const logger = createLogger({ service: 'workflow-engine' });

const kafka = new Kafka({
  clientId: config.kafka.clientId,
  brokers: config.kafka.brokers,
});

export function computeSlaDeadline(priority: string, startTime: Date): Date {
  const slaMs =
    priority === Priority.FLASH
      ? config.sla.flashMs
      : priority === Priority.URGENT
        ? config.sla.urgentMs
        : config.sla.normalMs;

  return new Date(startTime.getTime() + slaMs);
}

export async function setSlaDeadline(
  documentId: string,
  priority: string,
  correlationId: string,
): Promise<string> {
  const reqLogger = withCorrelation(logger, correlationId, { documentId });
  const deadline = computeSlaDeadline(priority, new Date());

  await prisma.document.update({
    where: { id: documentId },
    data: { slaDeadline: deadline, status: 'VALIDATED' },
  });

  reqLogger.info({ deadline, priority }, 'SLA deadline set');
  return deadline.toISOString();
}

export async function emitEscalationEvent(
  documentId: string,
  trackingCode: string,
  slaDeadline: string,
  overdueByMinutes: number,
  correlationId: string,
): Promise<void> {
  const reqLogger = withCorrelation(logger, correlationId, { documentId });
  const producer = kafka.producer({ createPartitioner: Partitioners.DefaultPartitioner });
  await producer.connect();

  const event: HitlEscalationEvent = {
    eventId: uuidv4(),
    correlationId,
    timestamp: new Date().toISOString(),
    version: '1.0',
    type: 'hitl.escalation',
    payload: {
      documentId,
      trackingCode,
      slaDeadline,
      overdueByMinutes,
      assignedRole: 'QUAN_LY' as never,
    },
  };

  await producer.send({
    topic: KAFKA_TOPICS.HITL_ESCALATION,
    messages: [{ key: documentId, value: JSON.stringify(event) }],
  });

  await producer.disconnect();
  reqLogger.warn({ overdueByMinutes }, 'SLA escalation event emitted');
}

export async function emitLeaderApprovalEvent(
  documentId: string,
  trackingCode: string,
  correlationId: string,
): Promise<void> {
  const reqLogger = withCorrelation(logger, correlationId, { documentId });
  const producer = kafka.producer({ createPartitioner: Partitioners.DefaultPartitioner });
  await producer.connect();

  const event = {
    eventId: uuidv4(),
    correlationId,
    timestamp: new Date().toISOString(),
    version: '1.0',
    type: 'hitl.pending',
    payload: {
      documentId,
      trackingCode,
      taskType: 'LEADER_APPROVAL',
      assignedRole: 'LANH_DAO',
      reason: 'Cần lãnh đạo phê duyệt (Final Approval)',
    },
  };

  await producer.send({
    topic: KAFKA_TOPICS.HITL_PENDING,
    messages: [{ key: documentId, value: JSON.stringify(event) }],
  });

  await producer.disconnect();
  reqLogger.info('Leader approval HITL task event emitted');
}

