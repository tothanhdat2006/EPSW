import { Kafka, Producer, Partitioners } from 'kafkajs';
import { config } from '../config.js';
import type { KafkaEvent } from '@dvc/shared-types';

let producer: Producer | null = null;

function getKafka(): Kafka {
  return new Kafka({
    clientId: config.kafka.clientId,
    brokers: config.kafka.brokers,
    retry: {
      initialRetryTime: 300,
      retries: 8,
    },
  });
}

export async function getProducer(): Promise<Producer> {
  if (!producer) {
    const kafka = getKafka();
    producer = kafka.producer({
      createPartitioner: Partitioners.DefaultPartitioner,
      idempotent: true,
    });
    await producer.connect();
  }
  return producer;
}

export async function publishEvent(topic: string, event: KafkaEvent): Promise<void> {
  const p = await getProducer();
  await p.send({
    topic,
    messages: [
      {
        key: event.payload && 'documentId' in event.payload
          ? (event.payload as { documentId: string }).documentId
          : event.correlationId,
        value: JSON.stringify(event),
        headers: {
          correlationId: event.correlationId,
          eventType: event.type,
          version: event.version,
        },
      },
    ],
  });
}

export async function disconnectProducer(): Promise<void> {
  if (producer) {
    await producer.disconnect();
    producer = null;
  }
}
