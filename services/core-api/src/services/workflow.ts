import { Queue, Worker, QueueEvents, JobsOptions, Job } from 'bullmq';
import Redis from 'ioredis';
import { createLogger, withCorrelation } from '@dvc/logger';
import { eq, and, inArray, sql } from 'drizzle-orm';
import { documents, hitlTasks, type Priority } from '../db/schema.js';
import { getDb, type Database } from '../db/index.js';
import { config } from '../config.js';
import {
  downloadFile,
  ensureBucketExists,
  parseObjectKeyFromUrl,
} from './storage.js';
import {
  analyzeDocumentText,
  computeOverallConfidence,
  extractTextWithAlibabaOCR,
} from './ai.js';
import { emailService } from './email-service.js';

const logger = createLogger({ service: 'core-api' });

const connection = new Redis(config.redis.url, { maxRetriesPerRequest: null });

export const workflowQueue = new Queue('document-workflow', { connection });
export const workflowQueueEvents = new QueueEvents('document-workflow', { connection });

interface ProcessDocumentJob {
  documentId: string;
  trackingCode: string;
  rawFileUrl: string;
  mimeType: string;
  submitterId: string;
  priority: Priority;
  correlationId: string;
}

interface SlaCheckJob {
  documentId: string;
  trackingCode: string;
  correlationId: string;
}

interface NotificationJob {
  recipientId: string;
  email?: string;
  name: string;
  trackingCode: string;
  subject: string;
  body: string;
  type: 'RECEIVED' | 'APPROVED' | 'REJECTED';
  reason?: string;
  correlationId: string;
}

function getPriorityDelayMs(priority: Priority): number {
  switch (priority) {
    case 'FLASH':
      return 30 * 60 * 1000;
    case 'URGENT':
      return 2 * 60 * 60 * 1000;
    default:
      return 48 * 60 * 60 * 1000;
  }
}

function computeSlaDeadline(priority: Priority): Date {
  return new Date(Date.now() + getPriorityDelayMs(priority));
}

async function ensureTask(
  db: Database,
  documentId: string,
  taskType: string,
  assignedRole: string,
): Promise<void> {
  const existing = await db.select()
    .from(hitlTasks)
    .where(
      and(
        eq(hitlTasks.documentId, documentId),
        eq(hitlTasks.taskType, taskType),
        inArray(hitlTasks.status, ['PENDING', 'IN_PROGRESS'])
      )
    )
    .limit(1);

  if (existing.length === 0) {
    await db.insert(hitlTasks).values({
      id: crypto.randomUUID(),
      documentId,
      taskType,
      assignedRole,
      status: 'PENDING',
    });
  }
}

async function processDocumentJob(db: Database, data: ProcessDocumentJob): Promise<void> {
  const reqLogger = withCorrelation(logger, data.correlationId, { documentId: data.documentId });

  await db.update(documents)
    .set({ status: 'PROCESSING', updatedAt: new Date() })
    .where(eq(documents.id, data.documentId));

  const { bucket, objectKey } = parseObjectKeyFromUrl(data.rawFileUrl);
  const fileBytes = await downloadFile(bucket, objectKey);
  const rawText = await extractTextWithAlibabaOCR(data.rawFileUrl, data.mimeType, fileBytes);

  if (!rawText.trim()) {
    await db.update(documents)
      .set({
        status: 'HITL_REVIEW',
        updatedAt: new Date(),
        extractedData: JSON.stringify({
          rawText,
          ocrError: 'UNREADABLE',
        }),
      })
      .where(eq(documents.id, data.documentId));

    await ensureTask(db, data.documentId, 'OCR_FIX', 'VAN_THU');
    reqLogger.warn('OCR produced empty text; routed to HITL OCR_FIX');
    return;
  }

  const analysis = await analyzeDocumentText(rawText);
  const aiConfidence = computeOverallConfidence(
    analysis.classificationConfidence,
    analysis.extractionConfidence,
  );

  const extractedData = {
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

  const doc = await db.select().from(documents).where(eq(documents.id, data.documentId)).limit(1);
  const citizenEmail = doc[0]?.citizenEmail;

  if (aiConfidence < config.confidenceThreshold) {
    await db.update(documents)
      .set({
        status: 'HITL_REVIEW',
        extractedData: JSON.stringify(extractedData),
        aiConfidence,
        securityLevel: analysis.securityLevel as any,
        updatedAt: new Date()
      })
      .where(eq(documents.id, data.documentId));

    await ensureTask(db, data.documentId, 'AI_REVIEW', 'CHUYEN_VIEN');
    reqLogger.warn({ aiConfidence }, 'Confidence below threshold; routed to HITL AI_REVIEW');
    return;
  }

  const slaDeadline = computeSlaDeadline(data.priority);

  await db.update(documents)
    .set({
      status: 'VALIDATED',
      extractedData: JSON.stringify(extractedData),
      aiConfidence,
      securityLevel: analysis.securityLevel as any,
      assignedDept: analysis.department,
      slaDeadline,
      updatedAt: new Date()
    })
    .where(eq(documents.id, data.documentId));

  await ensureTask(db, data.documentId, 'LEADER_APPROVAL', 'LANH_DAO');

  await enqueueSlaCheck({
    documentId: data.documentId,
    trackingCode: data.trackingCode,
    correlationId: data.correlationId,
  }, {
    delay: getPriorityDelayMs(data.priority),
    removeOnComplete: true,
    removeOnFail: 50,
  });

  await enqueueNotification({
    recipientId: data.submitterId,
    email: citizenEmail || undefined,
    name: analysis.subjectName || 'Quý khách',
    trackingCode: data.trackingCode,
    subject: `Ho so ${data.trackingCode} da duoc xac thuc`,
    body: `Ho so cua ban da qua buoc xu ly AI va dang cho phe duyet cuoi cung.`,
    type: 'RECEIVED',
    correlationId: data.correlationId,
  });

  reqLogger.info({ aiConfidence }, 'Document validated and waiting for leader approval');
}

async function processSlaCheckJob(db: Database, data: SlaCheckJob): Promise<void> {
  const reqLogger = withCorrelation(logger, data.correlationId, { documentId: data.documentId });

  const docs = await db.select().from(documents).where(eq(documents.id, data.documentId)).limit(1);
  const doc = docs[0];
  if (!doc) {
    return;
  }

  if (doc.status === 'APPROVED' || doc.status === 'PUBLISHED' || doc.status === 'REJECTED') {
    return;
  }

  await ensureTask(db, data.documentId, 'MANAGER_ESCALATION', 'QUAN_LY');
  await db.update(documents)
    .set({ status: 'HITL_REVIEW', updatedAt: new Date() })
    .where(eq(documents.id, data.documentId));

  reqLogger.warn('SLA breached, created MANAGER_ESCALATION task');
}

async function processNotificationJob(data: NotificationJob): Promise<void> {
  const to = data.email || `${data.recipientId}@example.com`;
  
  if (data.type === 'RECEIVED') {
    await emailService.notifyDocumentReceived(to, data.name, data.trackingCode);
  } else if (data.type === 'APPROVED') {
    await emailService.notifyDocumentApproved(to, data.name, data.trackingCode);
  } else if (data.type === 'REJECTED') {
    await emailService.notifyDocumentRejected(to, data.name, data.trackingCode, data.reason || 'Thông tin không hợp lệ');
  }
}

let worker: Worker | null = null;

/**
 * Note: dbInstance should be provided in worker context. 
 * Since this is a shared file between Node/Express and Worker, 
 * we handle db initialization carefully.
 */
export function startWorkflowWorker(dbInstance?: Database): void {
  if (worker) {
    return;
  }

  worker = new Worker(
    'document-workflow',
    async (job: Job) => {
      // Logic for obtaining db instance if not provided (e.g. from global or binding)
      const db = dbInstance;
      if (!db) {
        logger.error('Database instance NOT provided to worker');
        return;
      }

      if (job.name === 'process-document') {
        await processDocumentJob(db, job.data as ProcessDocumentJob);
        return;
      }

      if (job.name === 'sla-check') {
        await processSlaCheckJob(db, job.data as SlaCheckJob);
        return;
      }

      if (job.name === 'send-notification') {
        await processNotificationJob(job.data as NotificationJob);
      }
    },
    { connection },
  );

  worker.on('completed', (job: Job) => {
    logger.info({ jobId: job.id, name: job.name }, 'BullMQ job completed');
  });

  worker.on('failed', (job: Job | undefined, err: Error) => {
    logger.error({ jobId: job?.id, name: job?.name, err }, 'BullMQ job failed');
  });

  logger.info('BullMQ workflow worker started');
}

export async function stopWorkflowWorker(): Promise<void> {
  if (worker) {
    await worker.close();
    worker = null;
  }

  await workflowQueue.close();
  await workflowQueueEvents.close();
  await connection.quit();
}

export async function enqueueDocumentProcessing(
  data: ProcessDocumentJob,
  opts?: JobsOptions,
): Promise<void> {
  await workflowQueue.add('process-document', data, {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: true,
    removeOnFail: 100,
    ...opts,
  });
}

export async function enqueueSlaCheck(
  data: SlaCheckJob,
  opts?: JobsOptions,
): Promise<void> {
  await workflowQueue.add('sla-check', data, {
    attempts: 1,
    removeOnComplete: true,
    removeOnFail: 50,
    ...opts,
  });
}

export async function enqueueNotification(
  data: NotificationJob,
  opts?: JobsOptions,
): Promise<void> {
  await workflowQueue.add('send-notification', data, {
    attempts: 3,
    backoff: { type: 'exponential', delay: 1000 },
    removeOnComplete: true,
    removeOnFail: 100,
    ...opts,
  });
}

export async function markDocumentApproved(
  db: Database,
  documentId: string,
  approvedBy: string,
  correlationId: string,
): Promise<void> {
  const docs = await db.select().from(documents).where(eq(documents.id, documentId)).limit(1);
  const doc = docs[0];
  if (!doc) {
    throw new Error('Document not found');
  }

  const extracted = doc.extractedData ? (JSON.parse(doc.extractedData) as Record<string, unknown>) : {};

  await ensureBucketExists(config.minio.bucketPublished);
  const publishedFileUrl = `${config.minio.useSSL ? 'https' : 'http'}://${config.minio.endPoint}:${config.minio.port}/${config.minio.bucketPublished}/${documentId}/result.json`;

  await db.update(documents)
    .set({
      status: 'PUBLISHED',
      updatedAt: new Date(),
      extractedData: JSON.stringify({
        ...extracted,
        approvedBy,
        publishedFileUrl,
        approvedAt: new Date().toISOString(),
      }),
    })
    .where(eq(documents.id, documentId));

  await db.update(hitlTasks)
    .set({
      status: 'RESOLVED',
      resolvedAt: new Date(),
      resolutionData: JSON.stringify({ approved: true, approvedBy }),
    })
    .where(
      and(
        eq(hitlTasks.documentId, documentId),
        eq(hitlTasks.taskType, 'LEADER_APPROVAL'),
        inArray(hitlTasks.status, ['PENDING', 'IN_PROGRESS'])
      )
    );

  await enqueueNotification({
    recipientId: doc.submitterId,
    email: doc.citizenEmail || undefined,
    name: (extracted.subjectName as string) || 'Quý khách',
    trackingCode: doc.trackingCode,
    subject: `Ho so ${doc.trackingCode} da duoc phe duyet`,
    body: `Ho so da duoc phe duyet boi ${approvedBy}. Ket qua da duoc phat hanh.`,
    type: 'APPROVED',
    correlationId,
  });
}

export async function markDocumentRejected(
  db: Database,
  documentId: string,
  reason: string,
  rejectedBy: string,
  correlationId: string,
): Promise<void> {
  const docs = await db.select().from(documents).where(eq(documents.id, documentId)).limit(1);
  const doc = docs[0];
  if (!doc) {
    throw new Error('Document not found');
  }

  const extracted = doc.extractedData ? (JSON.parse(doc.extractedData) as Record<string, unknown>) : {};

  await db.update(documents)
    .set({
      status: 'REJECTED',
      updatedAt: new Date(),
      extractedData: JSON.stringify({
        ...extracted,
        rejectionReason: reason,
        rejectedBy,
      }),
    })
    .where(eq(documents.id, documentId));

  await db.update(hitlTasks)
    .set({
      status: 'RESOLVED',
      resolvedAt: new Date(),
      resolutionData: JSON.stringify({ approved: false, reason, rejectedBy }),
    })
    .where(
      and(
        eq(hitlTasks.documentId, documentId),
        eq(hitlTasks.taskType, 'LEADER_APPROVAL'),
        inArray(hitlTasks.status, ['PENDING', 'IN_PROGRESS'])
      )
    );

  await ensureTask(db, documentId, 'THU_KY_REVIEW', 'THU_KY');

  await enqueueNotification({
    recipientId: doc.submitterId,
    email: doc.citizenEmail || undefined,
    name: (extracted.subjectName as string) || 'Quý khách',
    trackingCode: doc.trackingCode,
    subject: `Ho so ${doc.trackingCode} bi tu choi`,
    body: `Ly do tu choi: ${reason}`,
    type: 'REJECTED',
    reason,
    correlationId,
  });
}
