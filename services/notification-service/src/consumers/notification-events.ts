import { Kafka } from 'kafkajs';
import { KAFKA_TOPICS } from '@dvc/shared-types';
import { createLogger, withCorrelation } from '@dvc/logger';
import { sendEmail } from '../providers/email.js';
import { sendSms } from '../providers/sms.js';
import { sendZaloMessage } from '../providers/zalo.js';
import { generateApprovalSummary, translateRejectionReason } from '../providers/llm-summary.js';
import { config } from '../config.js';
import { v4 as uuidv4 } from 'uuid';

const logger = createLogger({ service: 'notification-service' });

// Stub: resolve recipient contact details from user directory
async function resolveContact(
  recipientId: string,
): Promise<{ email?: string; phone?: string; zaloId?: string }> {
  // In production: call Keycloak admin API or internal user service
  return { email: `${recipientId}@example.com` };
}

export async function startNotificationConsumer(): Promise<void> {
  const kafka = new Kafka({ clientId: config.kafka.clientId, brokers: config.kafka.brokers });
  const consumer = kafka.consumer({ groupId: config.kafka.groupId });

  await consumer.connect();
  await consumer.subscribe({
    topics: [
      KAFKA_TOPICS.NOTIFICATION_SEND,
      KAFKA_TOPICS.DOCUMENT_APPROVED,
      KAFKA_TOPICS.DOCUMENT_REJECTED,
      KAFKA_TOPICS.DOCUMENT_VALIDATED,
    ],
    fromBeginning: false,
  });

  logger.info({ topics: [KAFKA_TOPICS.NOTIFICATION_SEND] }, 'Notification consumer started');

  await consumer.run({
    eachMessage: async ({ topic, message }) => {
      if (!message.value) return;

      const event = JSON.parse(message.value.toString());
      const correlationId: string = event.correlationId ?? uuidv4();
      const reqLogger = withCorrelation(logger, correlationId);
      const payload = event.payload ?? {};

      try {
        const contact = await resolveContact(payload.recipientId ?? payload.submitterId ?? '');
        const channels: string[] = payload.channels ?? ['EMAIL'];

        let subject = payload.subject ?? 'Thông báo từ Cổng DVC';
        let body = payload.body ?? '';

        // For approval events: generate LLM summary
        if (topic === KAFKA_TOPICS.DOCUMENT_APPROVED && payload.extractedData) {
          const summary = await generateApprovalSummary(
            payload.extractedData,
            payload.trackingCode ?? '',
          );
          body = `${body}\n\n${summary}`;
        }

        // For rejection events: translate reason via LLM
        if (topic === KAFKA_TOPICS.DOCUMENT_REJECTED && payload.rejectionReason) {
          const { translatedReason } = await translateRejectionReason(
            payload.rejectionReason,
            payload.documentType ?? 'unknown',
            payload.trackingCode ?? '',
          );
          body = translatedReason;
          subject = `Hồ sơ ${payload.trackingCode} bị từ chối — hướng dẫn xử lý`;
        }

        const dispatched: string[] = [];

        if (channels.includes('EMAIL') && contact.email) {
          await sendEmail(contact.email, subject, `<p>${body.replace(/\n/g, '<br>')}</p>`);
          dispatched.push('EMAIL');
        }

        if (channels.includes('SMS') && contact.phone) {
          await sendSms(contact.phone, `${subject}: ${body.slice(0, 160)}`);
          dispatched.push('SMS');
        }

        if (channels.includes('ZALO') && contact.zaloId) {
          await sendZaloMessage(contact.zaloId, `${subject}\n${body}`);
          dispatched.push('ZALO');
        }

        reqLogger.info(
          { documentId: payload.documentId, dispatched },
          'Notification dispatched',
        );
      } catch (err) {
        reqLogger.error({ err, topic, documentId: payload.documentId }, 'Failed to dispatch notification');
      }
    },
  });
}
