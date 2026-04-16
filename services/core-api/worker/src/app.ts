import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { z } from 'zod';
import { correlationIdMiddleware, optionalAuth, requireAuth } from './auth.js';
import {
  claimHitlTask,
  createDocument,
  ensureOpenHitlTask,
  getDocumentById,
  getDocumentByTrackingCode,
  getHitlTaskById,
  insertAuditLog,
  listDocuments,
  listOpenHitlTasks,
  resolveHitlTask,
  setDocumentPublished,
  setDocumentRejected,
  setDocumentStatus,
} from './db.js';
import { allowedMimeTypes, getRuntimeConfig, type WorkerEnv } from './env.js';
import { enqueueDocumentProcessing, enqueueNotification } from './queue.js';
import type { PriorityValue, WorkerAppVariables } from './types.js';

const PrioritySchema = z.enum(['NORMAL', 'URGENT', 'FLASH']);

const CreateFromExistingObjectSchema = z.object({
  objectKey: z.string().min(1),
  mimeType: z.string().min(1),
  priority: PrioritySchema.optional().default('NORMAL'),
  submitterId: z.string().optional(),
});

const ApproveSchema = z.object({
  approved: z.boolean(),
  reason: z.string().optional(),
});

const ResolveTaskSchema = z.object({
  resolutionData: z.record(z.unknown()),
});

function parsePriority(value: string | null | undefined): PriorityValue {
  const parsed = PrioritySchema.safeParse(value);
  if (parsed.success) {
    return parsed.data;
  }
  return 'NORMAL';
}

function sanitizeFileName(fileName: string): string {
  return fileName
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .slice(0, 120);
}

function buildTrackingCode(documentId: string): string {
  return `DVC-${Date.now()}-${documentId.slice(0, 8).toUpperCase()}`;
}

function canActOnTask(userRoles: string[], requiredRole: string): boolean {
  if (userRoles.includes('ADMIN') || userRoles.includes('LANH_DAO') || userRoles.includes('QUAN_LY')) {
    return true;
  }
  return userRoles.includes(requiredRole);
}

export const workerApp = new Hono<{
  Bindings: WorkerEnv;
  Variables: WorkerAppVariables;
}>();

workerApp.use('*', cors());
workerApp.use('*', correlationIdMiddleware);

workerApp.get('/health', (c) => c.json({ status: 'ok', service: 'core-api-worker' }));

workerApp.post('/api/documents/upload', optionalAuth, async (c) => {
  const runtime = getRuntimeConfig(c.env);
  const form = await c.req.formData();
  const file = form.get('file');

  if (!(file instanceof File)) {
    return c.json({ error: 'File is required' }, 400);
  }

  if (!allowedMimeTypes.includes(file.type as (typeof allowedMimeTypes)[number])) {
    return c.json({ error: `Unsupported file type: ${file.type}` }, 400);
  }

  if (file.size > runtime.maxFileSizeBytes) {
    return c.json({ error: `File exceeds maximum size of ${runtime.maxFileSizeBytes} bytes` }, 400);
  }

  const priority = parsePriority(form.get('priority')?.toString());
  const submitterId = c.get('user')?.sub ?? 'anonymous';
  const correlationId = c.get('correlationId');
  const documentId = crypto.randomUUID();
  const trackingCode = buildTrackingCode(documentId);
  const safeName = sanitizeFileName(file.name || 'document.bin');
  const objectKey = `${documentId}/${safeName}`;
  const rawFileUrl = `r2://documents/${objectKey}`;

  await c.env.R2_DOCUMENTS.put(objectKey, await file.arrayBuffer(), {
    httpMetadata: {
      contentType: file.type || 'application/octet-stream',
    },
    customMetadata: {
      trackingCode,
      submitterId,
    },
  });

  await createDocument(c.env.DB, {
    id: documentId,
    trackingCode,
    submitterId,
    priority,
    rawFileUrl,
  });

  await enqueueDocumentProcessing(c.env, {
    documentId,
    trackingCode,
    rawFileUrl,
    mimeType: file.type,
    submitterId,
    priority,
    correlationId,
  });

  await insertAuditLog(
    c.env.DB,
    documentId,
    'DOCUMENT_RECEIVED',
    submitterId,
    'CITIZEN',
    correlationId,
    {
      objectKey,
      mimeType: file.type,
      priority,
    },
  );

  return c.json(
    {
      message: 'Document received. Processing has started.',
      documentId,
      trackingCode,
      status: 'RECEIVED',
    },
    202,
  );
});

workerApp.post('/api/documents', optionalAuth, async (c) => {
  const payload = await c.req.json().catch(() => null);
  const parsed = CreateFromExistingObjectSchema.safeParse(payload);
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  const { objectKey, mimeType, priority } = parsed.data;
  if (!allowedMimeTypes.includes(mimeType as (typeof allowedMimeTypes)[number])) {
    return c.json({ error: `Unsupported file type: ${mimeType}` }, 400);
  }

  const object = await c.env.R2_DOCUMENTS.head(objectKey);
  if (!object) {
    return c.json({ error: 'Object key not found in R2' }, 404);
  }

  const submitterId = parsed.data.submitterId ?? c.get('user')?.sub ?? 'anonymous';
  const correlationId = c.get('correlationId');
  const documentId = crypto.randomUUID();
  const trackingCode = buildTrackingCode(documentId);
  const rawFileUrl = `r2://documents/${objectKey}`;

  await createDocument(c.env.DB, {
    id: documentId,
    trackingCode,
    submitterId,
    priority,
    rawFileUrl,
  });

  await enqueueDocumentProcessing(c.env, {
    documentId,
    trackingCode,
    rawFileUrl,
    mimeType,
    submitterId,
    priority,
    correlationId,
  });

  return c.json(
    {
      message: 'Document received. Processing has started.',
      documentId,
      trackingCode,
      status: 'RECEIVED',
    },
    202,
  );
});

workerApp.get('/api/documents', optionalAuth, async (c) => {
  const status = c.req.query('status');
  const priority = c.req.query('priority');
  const page = Number(c.req.query('page') ?? '1');

  const result = await listDocuments(c.env.DB, {
    status,
    priority,
    page: Number.isFinite(page) ? page : 1,
    pageSize: 10,
  });

  return c.json(result);
});

workerApp.get('/api/documents/id/:id', optionalAuth, async (c) => {
  const id = c.req.param('id');
  const document = await getDocumentById(c.env.DB, id);
  if (!document) {
    return c.json({ error: 'Document not found' }, 404);
  }
  return c.json(document);
});

workerApp.get('/api/documents/:trackingCode', optionalAuth, async (c) => {
  const trackingCode = c.req.param('trackingCode');
  const document = await getDocumentByTrackingCode(c.env.DB, trackingCode);
  if (!document) {
    return c.json({ error: 'Document not found' }, 404);
  }
  return c.json(document);
});

workerApp.post('/api/documents/:documentId/approve', requireAuth, async (c) => {
  const documentId = c.req.param('documentId');
  const payload = await c.req.json().catch(() => null);
  const parsed = ApproveSchema.safeParse(payload);

  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  const document = await getDocumentById(c.env.DB, documentId);
  if (!document) {
    return c.json({ error: 'Document not found' }, 404);
  }

  const actor = c.get('user')?.preferred_username ?? c.get('user')?.sub ?? 'system';
  const correlationId = c.get('correlationId');

  if (parsed.data.approved) {
    const publishedFileUrl = `r2://documents/${documentId}/result.json`;
    await setDocumentPublished(c.env.DB, documentId, actor, publishedFileUrl);
    await setDocumentStatus(c.env.DB, documentId, 'PUBLISHED');

    await enqueueNotification(c.env, {
      recipientId: document.submitterId,
      subject: `Ho so ${document.trackingCode} da duoc phe duyet`,
      body: `Ho so da duoc phe duyet boi ${actor}.`,
      correlationId,
    });

    return c.json({ message: 'Document approved' });
  }

  const reason = parsed.data.reason ?? 'Rejected by leader';
  await setDocumentRejected(c.env.DB, documentId, actor, reason);
  await ensureOpenHitlTask(c.env.DB, documentId, 'THU_KY_REVIEW', 'THU_KY');

  await enqueueNotification(c.env, {
    recipientId: document.submitterId,
    subject: `Ho so ${document.trackingCode} bi tu choi`,
    body: `Ly do tu choi: ${reason}`,
    correlationId,
  });

  return c.json({ message: 'Document rejected' });
});

workerApp.get('/api/hitl/tasks', requireAuth, async (c) => {
  const roles = c.get('user')?.realm_access?.roles ?? [];
  const tasks = await listOpenHitlTasks(c.env.DB, roles);
  return c.json({ tasks });
});

workerApp.post('/api/hitl/tasks/:taskId/claim', requireAuth, async (c) => {
  const taskId = c.req.param('taskId');
  const task = await getHitlTaskById(c.env.DB, taskId);
  if (!task) {
    return c.json({ error: 'Task not found' }, 404);
  }

  if (task.status !== 'PENDING') {
    return c.json({ error: 'Task is not available for claiming' }, 409);
  }

  const roles = c.get('user')?.realm_access?.roles ?? [];
  if (!canActOnTask(roles, task.assignedRole)) {
    return c.json({ error: 'Insufficient role to claim this task' }, 403);
  }

  const userId = c.get('user')?.sub ?? 'unknown';
  await claimHitlTask(c.env.DB, taskId, userId);
  return c.json({ message: 'Task claimed', taskId });
});

workerApp.post('/api/hitl/tasks/:taskId/resolve', requireAuth, async (c) => {
  const taskId = c.req.param('taskId');
  const payload = await c.req.json().catch(() => null);
  const parsed = ResolveTaskSchema.safeParse(payload);

  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  const task = await getHitlTaskById(c.env.DB, taskId);
  if (!task) {
    return c.json({ error: 'Task not found' }, 404);
  }

  const userId = c.get('user')?.sub ?? 'unknown';
  const roles = c.get('user')?.realm_access?.roles ?? [];
  if (task.assignedUserId && task.assignedUserId !== userId && !canActOnTask(roles, task.assignedRole)) {
    return c.json({ error: 'Not authorized to resolve this task' }, 403);
  }

  await resolveHitlTask(c.env.DB, taskId, parsed.data.resolutionData);

  if (task.taskType === 'AI_REVIEW') {
    const approved = Boolean(parsed.data.resolutionData['approved']);
    await setDocumentStatus(c.env.DB, task.documentId, approved ? 'VALIDATED' : 'REJECTED');
  }

  if (task.taskType === 'MANAGER_ESCALATION') {
    await setDocumentStatus(c.env.DB, task.documentId, 'VALIDATED');
  }

  return c.json({ message: 'Task resolved successfully', taskId });
});

workerApp.onError((error, c) => {
  console.error('[worker] unhandled error', {
    error,
    correlationId: c.get('correlationId'),
  });
  return c.json({ error: 'Internal server error' }, 500);
});
