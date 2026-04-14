import { Kafka, Partitioners } from 'kafkajs';
import { KAFKA_TOPICS, type NotificationSendEvent, type DocumentValidatedEvent } from '@dvc/shared-types';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config.js';

const kafka = new Kafka({
  clientId: config.kafka.clientId,
  brokers: config.kafka.brokers,
});

export async function publishNotification(
  recipientId: string,
  subject: string,
  body: string,
  correlationId: string,
  documentId?: string,
  trackingCode?: string,
): Promise<void> {
  const producer = kafka.producer({ createPartitioner: Partitioners.DefaultPartitioner });
  await producer.connect();

  const event: NotificationSendEvent = {
    eventId: uuidv4(),
    correlationId,
    timestamp: new Date().toISOString(),
    version: '1.0',
    type: 'notification.send',
    payload: {
      recipientId,
      channels: ['EMAIL', 'PORTAL'],
      subject,
      body,
      documentId,
      trackingCode,
    },
  };

  await producer.send({
    topic: KAFKA_TOPICS.NOTIFICATION_SEND,
    messages: [{ key: recipientId, value: JSON.stringify(event) }],
  });

  await producer.disconnect();
}

export async function publishValidatedEvent(
  documentId: string,
  trackingCode: string,
  submitterId: string,
  assignedDepartment: string,
  slaDeadline: string,
  correlationId: string,
): Promise<void> {
  const producer = kafka.producer({ createPartitioner: Partitioners.DefaultPartitioner });
  await producer.connect();

  const event: DocumentValidatedEvent = {
    eventId: uuidv4(),
    correlationId,
    timestamp: new Date().toISOString(),
    version: '1.0',
    type: 'document.validated',
    payload: {
      documentId,
      trackingCode,
      submitterId,
      assignedDepartment,
      slaDeadline,
    },
  };

  await producer.send({
    topic: KAFKA_TOPICS.DOCUMENT_VALIDATED,
    messages: [{ key: documentId, value: JSON.stringify(event) }],
  });

  await producer.disconnect();
}
