import { Queue, Worker, QueueEvents, JobsOptions, Job } from 'bullmq';
import Redis from 'ioredis';
import { createLogger, withCorrelation } from '@dvc/logger';
import { prisma } from '@dvc/database';
import { Priority } from '@dvc/shared-types';
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
import { sendEmail } from './notifications.js';

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
  subject: string;
  body: string;
  correlationId: string;
}

function getPriorityDelayMs(priority: Priority): number {
  switch (priority) {
    case Priority.FLASH:
      return 30 * 60 * 1000;
    case Priority.URGENT:
      return 2 * 60 * 60 * 1000;
    default:
      return 48 * 60 * 60 * 1000;
  }
}

function computeSlaDeadline(priority: Priority): Date {
  return new Date(Date.now() + getPriorityDelayMs(priority));
}

async function ensureTask(
  documentId: string,
  taskType: string,
  assignedRole: string,
): Promise<void> {
  const existing = await prisma.hitlTask.findFirst({
    where: {
      documentId,
      taskType,
      status: { in: ['PENDING', 'IN_PROGRESS'] },
    },
  });

  if (!existing) {
    await prisma.hitlTask.create({
      data: {
        documentId,
        taskType,
        assignedRole,
        status: 'PENDING',
      },
    });
  }
}

async function processDocumentJob(data: ProcessDocumentJob): Promise<void> {
  const reqLogger = withCorrelation(logger, data.correlationId, { documentId: data.documentId });

  await prisma.document.update({
    where: { id: data.documentId },
    data: { status: 'PROCESSING' },
  });

  const { bucket, objectKey } = parseObjectKeyFromUrl(data.rawFileUrl);
  const fileBytes = await downloadFile(bucket, objectKey);
  const rawText = await extractTextWithAlibabaOCR(data.rawFileUrl, data.mimeType, fileBytes);

  if (!rawText.trim()) {
    await prisma.document.update({
      where: { id: data.documentId },
      data: {
        status: 'HITL_REVIEW',
        extractedData: {
          rawText,
          ocrError: 'UNREADABLE',
        } as any,
      },
    });

    await ensureTask(data.documentId, 'OCR_FIX', 'VAN_THU');
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

  if (aiConfidence < config.confidenceThreshold) {
    await prisma.document.update({
      where: { id: data.documentId },
      data: {
        status: 'HITL_REVIEW',
        extractedData: extractedData as any,
        aiConfidence,
        securityLevel: analysis.securityLevel,
      },
    });

    await ensureTask(data.documentId, 'AI_REVIEW', 'CHUYEN_VIEN');
    reqLogger.warn({ aiConfidence }, 'Confidence below threshold; routed to HITL AI_REVIEW');
    return;
  }

  const slaDeadline = computeSlaDeadline(data.priority);

  await prisma.document.update({
    where: { id: data.documentId },
    data: {
      status: 'VALIDATED',
      extractedData: extractedData as any,
      aiConfidence,
      securityLevel: analysis.securityLevel,
      assignedDept: analysis.department,
      slaDeadline,
    },
  });

  await ensureTask(data.documentId, 'LEADER_APPROVAL', 'LANH_DAO');

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
    subject: `Ho so ${data.trackingCode} da duoc xac thuc`,
    body: `Ho so cua ban da qua buoc xu ly AI va dang cho phe duyet cuoi cung.`,
    correlationId: data.correlationId,
  });

  reqLogger.info({ aiConfidence }, 'Document validated and waiting for leader approval');
}

async function processSlaCheckJob(data: SlaCheckJob): Promise<void> {
  const reqLogger = withCorrelation(logger, data.correlationId, { documentId: data.documentId });

  const doc = await prisma.document.findUnique({ where: { id: data.documentId } });
  if (!doc) {
    return;
  }

  if (doc.status === 'APPROVED' || doc.status === 'PUBLISHED' || doc.status === 'REJECTED') {
    return;
  }

  await ensureTask(data.documentId, 'MANAGER_ESCALATION', 'QUAN_LY');
  await prisma.document.update({
    where: { id: data.documentId },
    data: { status: 'HITL_REVIEW' },
  });

  reqLogger.warn('SLA breached, created MANAGER_ESCALATION task');
}

async function processNotificationJob(data: NotificationJob): Promise<void> {
  const to = `${data.recipientId}@example.com`;
  await sendEmail(to, data.subject, data.body);
}

let worker: Worker | null = null;

export function startWorkflowWorker(): void {
  if (worker) {
    return;
  }

  worker = new Worker(
    'document-workflow',
    async (job: Job) => {
      if (job.name === 'process-document') {
        await processDocumentJob(job.data as ProcessDocumentJob);
        return;
      }

      if (job.name === 'sla-check') {
        await processSlaCheckJob(job.data as SlaCheckJob);
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
  documentId: string,
  approvedBy: string,
  correlationId: string,
): Promise<void> {
  const doc = await prisma.document.findUnique({ where: { id: documentId } });
  if (!doc) {
    throw new Error('Document not found');
  }

  const extracted = (doc.extractedData as Record<string, unknown> | null) ?? {};

  await ensureBucketExists(config.minio.bucketPublished);
  const publishedFileUrl = `${config.minio.useSSL ? 'https' : 'http'}://${config.minio.endPoint}:${config.minio.port}/${config.minio.bucketPublished}/${documentId}/result.json`;

  await prisma.document.update({
    where: { id: documentId },
    data: {
      status: 'PUBLISHED',
      extractedData: {
        ...extracted,
        approvedBy,
        publishedFileUrl,
        approvedAt: new Date().toISOString(),
      } as any,
    },
  });

  await prisma.hitlTask.updateMany({
    where: {
      documentId,
      taskType: 'LEADER_APPROVAL',
      status: { in: ['PENDING', 'IN_PROGRESS'] },
    },
    data: {
      status: 'RESOLVED',
      resolutionData: { approved: true, approvedBy } as any,
      resolvedAt: new Date(),
    },
  });

  await enqueueNotification({
    recipientId: doc.submitterId,
    subject: `Ho so ${doc.trackingCode} da duoc phe duyet`,
    body: `Ho so da duoc phe duyet boi ${approvedBy}. Ket qua da duoc phat hanh.`,
    correlationId,
  });
}

export async function markDocumentRejected(
  documentId: string,
  reason: string,
  rejectedBy: string,
  correlationId: string,
): Promise<void> {
  const doc = await prisma.document.findUnique({ where: { id: documentId } });
  if (!doc) {
    throw new Error('Document not found');
  }

  await prisma.document.update({
    where: { id: documentId },
    data: {
      status: 'REJECTED',
      extractedData: {
        ...(doc.extractedData as Record<string, unknown> | null),
        rejectionReason: reason,
        rejectedBy,
      } as any,
    },
  });

  await prisma.hitlTask.updateMany({
    where: {
      documentId,
      taskType: 'LEADER_APPROVAL',
      status: { in: ['PENDING', 'IN_PROGRESS'] },
    },
    data: {
      status: 'RESOLVED',
      resolutionData: { approved: false, reason, rejectedBy } as any,
      resolvedAt: new Date(),
    },
  });

  await ensureTask(documentId, 'THU_KY_REVIEW', 'THU_KY');

  await enqueueNotification({
    recipientId: doc.submitterId,
    subject: `Ho so ${doc.trackingCode} bi tu choi`,
    body: `Ly do tu choi: ${reason}`,
    correlationId,
  });
}
