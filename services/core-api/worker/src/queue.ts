import {
  analyzeDocumentText,
  computeOverallConfidence,
  extractTextFromFile,
} from './ai.js';
import { getRuntimeConfig, type WorkerEnv } from './env.js';
import {
  ensureOpenHitlTask,
  escalateSlaBreach,
  getDocumentById,
  insertAuditLog,
  listDueSlaDocuments,
  setDocumentStatus,
  setDocumentToHitlReview,
  setDocumentValidated,
} from './db.js';
import { createUpstashClient } from './upstash.js';
import type {
  NotificationJob,
  PriorityValue,
  ProcessDocumentJob,
  WorkflowQueueMessage,
} from './types.js';

function getPriorityDelayMs(priority: PriorityValue): number {
  switch (priority) {
    case 'FLASH':
      return 30 * 60 * 1000;
    case 'URGENT':
      return 2 * 60 * 60 * 1000;
    default:
      return 48 * 60 * 60 * 1000;
  }
}

function computeSlaDeadline(priority: PriorityValue): string {
  return new Date(Date.now() + getPriorityDelayMs(priority)).toISOString();
}

function parseR2ObjectKey(rawFileUrl: string): string | null {
  const prefix = 'r2://documents/';
  if (rawFileUrl.startsWith(prefix)) {
    return rawFileUrl.slice(prefix.length);
  }

  try {
    const url = new URL(rawFileUrl);
    const parts = url.pathname.split('/').filter(Boolean);
    return parts.slice(1).join('/') || null;
  } catch {
    return null;
  }
}

export async function enqueueDocumentProcessing(
  env: WorkerEnv,
  data: ProcessDocumentJob,
): Promise<void> {
  await env.WORKFLOW_QUEUE.send({
    type: 'process-document',
    payload: data,
  });
}

export async function enqueueNotification(
  env: WorkerEnv,
  data: NotificationJob,
): Promise<void> {
  await env.WORKFLOW_QUEUE.send({
    type: 'send-notification',
    payload: data,
  });
}

async function processNotificationJob(env: WorkerEnv, data: NotificationJob): Promise<void> {
  const runtime = getRuntimeConfig(env);

  if (!runtime.notificationWebhookUrl) {
    console.log('[notification] no webhook configured', {
      recipientId: data.recipientId,
      subject: data.subject,
    });
    return;
  }

  const response = await fetch(runtime.notificationWebhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Notification webhook failed (${response.status}): ${body}`);
  }
}

async function processDocumentJob(env: WorkerEnv, data: ProcessDocumentJob): Promise<void> {
  const runtime = getRuntimeConfig(env);
  const redis = createUpstashClient(env);
  const lockKey = `workflow:process:${data.documentId}`;
  let lockAcquired = true;

  if (redis) {
    lockAcquired = await redis.setNxWithTtl(lockKey, data.correlationId, 180);
  }

  if (!lockAcquired) {
    console.log('[workflow] lock already held, skipping duplicate job', {
      documentId: data.documentId,
    });
    return;
  }

  try {
    const doc = await getDocumentById(env.DB, data.documentId);
    if (!doc) {
      throw new Error('Document not found while processing queue job');
    }

    await setDocumentStatus(env.DB, data.documentId, 'PROCESSING');

    const objectKey = parseR2ObjectKey(data.rawFileUrl);
    if (!objectKey) {
      await setDocumentToHitlReview(env.DB, data.documentId, {
        extractedData: { rawText: '', ocrError: 'INVALID_RAW_FILE_URL' },
      });
      await ensureOpenHitlTask(env.DB, data.documentId, 'OCR_FIX', 'VAN_THU');
      return;
    }

    const object = await env.R2_DOCUMENTS.get(objectKey);
    if (!object) {
      await setDocumentToHitlReview(env.DB, data.documentId, {
        extractedData: { rawText: '', ocrError: 'OBJECT_NOT_FOUND' },
      });
      await ensureOpenHitlTask(env.DB, data.documentId, 'OCR_FIX', 'VAN_THU');
      return;
    }

    const bytes = new Uint8Array(await object.arrayBuffer());
    const rawText = await extractTextFromFile(env, data.rawFileUrl, data.mimeType, bytes);

    if (!rawText.trim()) {
      await setDocumentToHitlReview(env.DB, data.documentId, {
        extractedData: { rawText, ocrError: 'UNREADABLE' },
      });
      await ensureOpenHitlTask(env.DB, data.documentId, 'OCR_FIX', 'VAN_THU');

      await insertAuditLog(
        env.DB,
        data.documentId,
        'OCR_UNREADABLE',
        'system',
        'SYSTEM',
        data.correlationId,
      );
      return;
    }

    if (!runtime.llm.apiKey) {
      await setDocumentToHitlReview(env.DB, data.documentId, {
        extractedData: {
          rawText,
          aiError: 'LLM_API_KEY_NOT_CONFIGURED',
        },
      });
      await ensureOpenHitlTask(env.DB, data.documentId, 'AI_REVIEW', 'CHUYEN_VIEN');
      return;
    }

    const analysis = await analyzeDocumentText(env, rawText);
    const aiConfidence = computeOverallConfidence(
      analysis.classificationConfidence,
      analysis.extractionConfidence,
    );

    const extractedData: Record<string, unknown> = {
      documentType: analysis.documentType,
      urgency: analysis.urgency,
      securityLevel: analysis.securityLevel,
      department: analysis.department,
      summary: analysis.summary,
      issuingAuthority: analysis.issuingAuthority,
      issueDate: analysis.issueDate,
      expiryDate: analysis.expiryDate,
      subjectName: analysis.subjectName,
      subjectId: analysis.subjectId,
      address: analysis.address,
      purpose: analysis.purpose,
      referenceNumber: analysis.referenceNumber,
      keywords: analysis.keywords,
      rawText,
    };

    if (aiConfidence < runtime.confidenceThreshold) {
      await setDocumentToHitlReview(env.DB, data.documentId, {
        extractedData,
        aiConfidence,
        securityLevel: analysis.securityLevel,
      });
      await ensureOpenHitlTask(env.DB, data.documentId, 'AI_REVIEW', 'CHUYEN_VIEN');

      await insertAuditLog(
        env.DB,
        data.documentId,
        'AI_LOW_CONFIDENCE',
        'system',
        'SYSTEM',
        data.correlationId,
        { aiConfidence },
      );
      return;
    }

    await setDocumentValidated(env.DB, data.documentId, {
      extractedData,
      aiConfidence,
      securityLevel: analysis.securityLevel,
      assignedDept: analysis.department,
      slaDeadline: computeSlaDeadline(data.priority),
    });

    await ensureOpenHitlTask(env.DB, data.documentId, 'LEADER_APPROVAL', 'LANH_DAO');

    await enqueueNotification(env, {
      recipientId: data.submitterId,
      subject: `Ho so ${data.trackingCode} da duoc xac thuc`,
      body: 'Ho so cua ban da qua buoc xu ly AI va dang cho phe duyet cuoi cung.',
      correlationId: data.correlationId,
    });

    await insertAuditLog(
      env.DB,
      data.documentId,
      'DOCUMENT_VALIDATED',
      'system',
      'SYSTEM',
      data.correlationId,
      { aiConfidence },
    );
  } finally {
    if (redis) {
      await redis.del(lockKey);
    }
  }
}

export async function handleQueueBatch(
  batch: MessageBatch<WorkflowQueueMessage>,
  env: WorkerEnv,
): Promise<void> {
  for (const message of batch.messages) {
    try {
      if (message.body.type === 'process-document') {
        await processDocumentJob(env, message.body.payload);
      } else if (message.body.type === 'send-notification') {
        await processNotificationJob(env, message.body.payload);
      }

      message.ack();
    } catch (error) {
      console.error('[queue] job failed', {
        error,
        messageId: message.id,
      });
      message.retry();
    }
  }
}

export async function runSlaEscalationCron(env: WorkerEnv): Promise<void> {
  const dueDocuments = await listDueSlaDocuments(env.DB, new Date().toISOString());

  for (const doc of dueDocuments) {
    await escalateSlaBreach(env.DB, doc.id);

    await enqueueNotification(env, {
      recipientId: doc.submitterId,
      subject: `Ho so ${doc.trackingCode} can xu ly bo sung`,
      body: 'Ho so dang duoc quan ly xem xet do vuot qua han SLA.',
      correlationId: crypto.randomUUID(),
    });
  }
}
