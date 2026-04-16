import {
  createHitlTaskIfMissing,
  deleteScheduledJob,
  getDocumentById,
  getDueScheduledJobs,
  insertAuditLog,
  rescheduleScheduledJob,
  scheduleJob,
  updateDocumentStatus,
  updateDocumentValidation,
} from './db.js';
import { incrementMetric, pushNotificationLog } from './upstash.js';
import type {
  DocStatus,
  Priority,
  ProcessDocumentJob,
  ScheduledJobRow,
  SendNotificationJob,
  WorkerEnv,
  WorkflowQueueJob,
} from './types.js';

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

function finalStatuses(): DocStatus[] {
  return ['APPROVED', 'PUBLISHED', 'REJECTED'];
}

async function enqueueNotification(env: WorkerEnv, job: Omit<SendNotificationJob, 'type'>): Promise<void> {
  await env.WORKFLOW_QUEUE.send({
    type: 'send-notification',
    ...job,
  });
}

async function processDocumentJob(env: WorkerEnv, job: ProcessDocumentJob): Promise<void> {
  await updateDocumentStatus(env, job.documentId, 'PROCESSING');

  const confidenceThreshold = Number(env.CONFIDENCE_THRESHOLD ?? '70');
  const aiConfidence = 85;
  const assignedDept = 'VAN_PHONG_UBND';
  const extractedData: Record<string, unknown> = {
    summary: 'Document queued and processed on Cloudflare Workers pipeline.',
    pipeline: 'cloudflare-workers-v1',
    rawFileKey: job.rawFileKey,
    processedAt: new Date().toISOString(),
  };

  if (aiConfidence < confidenceThreshold) {
    await updateDocumentValidation(env, {
      documentId: job.documentId,
      extractedData,
      aiConfidence,
      securityLevel: 'UNCLASSIFIED',
      assignedDept,
      slaDeadline: new Date(Date.now() + getPriorityDelayMs(job.priority)).toISOString(),
      status: 'HITL_REVIEW',
    });

    await createHitlTaskIfMissing(env, {
      documentId: job.documentId,
      taskType: 'AI_REVIEW',
      assignedRole: 'CHUYEN_VIEN',
    });

    await incrementMetric(env, 'metrics:workflow:document_hitl');

    await insertAuditLog(env, {
      documentId: job.documentId,
      action: 'DOCUMENT_ROUTED_TO_HITL',
      actorId: 'system',
      actorRole: 'SYSTEM',
      correlationId: job.correlationId,
      metadata: { aiConfidence },
    });

    return;
  }

  const slaDeadline = new Date(Date.now() + getPriorityDelayMs(job.priority)).toISOString();

  await updateDocumentValidation(env, {
    documentId: job.documentId,
    extractedData,
    aiConfidence,
    securityLevel: 'UNCLASSIFIED',
    assignedDept,
    slaDeadline,
    status: 'VALIDATED',
  });

  await createHitlTaskIfMissing(env, {
    documentId: job.documentId,
    taskType: 'LEADER_APPROVAL',
    assignedRole: 'LANH_DAO',
  });

  await scheduleJob(env, {
    id: crypto.randomUUID(),
    jobType: 'sla-check',
    payloadJson: JSON.stringify({
      documentId: job.documentId,
      trackingCode: job.trackingCode,
      correlationId: job.correlationId,
    }),
    runAt: slaDeadline,
    maxAttempts: 3,
  });

  await enqueueNotification(env, {
    recipientId: job.submitterId,
    subject: `Ho so ${job.trackingCode} da duoc xac thuc`,
    body: 'Ho so cua ban da qua buoc xu ly AI va dang cho phe duyet cuoi cung.',
    correlationId: job.correlationId,
  });

  await insertAuditLog(env, {
    documentId: job.documentId,
    action: 'DOCUMENT_VALIDATED',
    actorId: 'system',
    actorRole: 'SYSTEM',
    correlationId: job.correlationId,
    metadata: { aiConfidence, assignedDept, slaDeadline },
  });

  await incrementMetric(env, 'metrics:workflow:document_validated');
}

async function processNotificationJob(env: WorkerEnv, job: SendNotificationJob): Promise<void> {
  await pushNotificationLog(env, {
    recipientId: job.recipientId,
    subject: job.subject,
    body: job.body,
    correlationId: job.correlationId,
    sentAt: new Date().toISOString(),
  });

  await incrementMetric(env, 'metrics:workflow:notification_sent');
}

export async function processWorkflowJob(env: WorkerEnv, job: WorkflowQueueJob): Promise<void> {
  if (job.type === 'process-document') {
    await processDocumentJob(env, job);
    return;
  }

  if (job.type === 'send-notification') {
    await processNotificationJob(env, job);
    return;
  }

  throw new Error(`Unknown workflow job type: ${(job as { type?: string }).type ?? 'undefined'}`);
}

async function handleSlaCheckJob(env: WorkerEnv, row: ScheduledJobRow): Promise<void> {
  const payload = JSON.parse(row.payload_json) as {
    documentId: string;
    trackingCode: string;
    correlationId: string;
  };

  const document = await getDocumentById(env, payload.documentId);
  if (!document) {
    await deleteScheduledJob(env, row.id);
    return;
  }

  if (finalStatuses().includes(document.status)) {
    await deleteScheduledJob(env, row.id);
    return;
  }

  await updateDocumentStatus(env, payload.documentId, 'HITL_REVIEW');
  await createHitlTaskIfMissing(env, {
    documentId: payload.documentId,
    taskType: 'MANAGER_ESCALATION',
    assignedRole: 'QUAN_LY',
  });

  await enqueueNotification(env, {
    recipientId: document.submitter_id,
    subject: `Ho so ${payload.trackingCode} can xu ly gap`,
    body: 'Ho so qua han SLA va da duoc chuyen sang buoc xu ly escalations.',
    correlationId: payload.correlationId,
  });

  await insertAuditLog(env, {
    documentId: payload.documentId,
    action: 'SLA_BREACHED',
    actorId: 'system',
    actorRole: 'SYSTEM',
    correlationId: payload.correlationId,
    metadata: { scheduledJobId: row.id },
  });

  await incrementMetric(env, 'metrics:workflow:sla_breached');
  await deleteScheduledJob(env, row.id);
}

function computeBackoffRunAt(attempt: number): string {
  const backoffMs = Math.min(5 * 60 * 1000 * Math.pow(2, attempt - 1), 2 * 60 * 60 * 1000);
  return new Date(Date.now() + backoffMs).toISOString();
}

export async function processDueScheduledJobs(env: WorkerEnv): Promise<void> {
  const dueJobs = await getDueScheduledJobs(env, 30);

  for (const row of dueJobs) {
    try {
      if (row.job_type === 'sla-check') {
        await handleSlaCheckJob(env, row);
      } else {
        await deleteScheduledJob(env, row.id);
      }
    } catch (error) {
      const nextAttempts = row.attempts + 1;
      if (nextAttempts >= row.max_attempts) {
        await deleteScheduledJob(env, row.id);
        await incrementMetric(env, 'metrics:workflow:scheduled_job_dropped');
        continue;
      }

      const message = error instanceof Error ? error.message : 'Unknown scheduled job error';
      await rescheduleScheduledJob(env, {
        jobId: row.id,
        attempts: nextAttempts,
        nextRunAt: computeBackoffRunAt(nextAttempts),
        lastError: message.slice(0, 1000),
      });
    }
  }
}
