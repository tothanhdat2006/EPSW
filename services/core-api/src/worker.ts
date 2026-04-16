import { authenticateRequest } from './worker/auth.js';
import { getAuth } from './worker/better-auth.js';
import {
  claimHitlTask,
  createDocument,
  createHitlTaskIfMissing,
  getDocumentById,
  getDocumentByTrackingCode,
  getHitlTaskById,
  insertAuditLog,
  listActiveHitlTasks,
  listDocuments,
  resolveHitlTask,
  resolveOpenTasksByType,
  updateDocumentDecision,
  updateDocumentStatus,
} from './worker/db.js';
import { incrementMetric } from './worker/upstash.js';
import { processDueScheduledJobs, processWorkflowJob } from './worker/workflow.js';
import type {
  AuthenticatedUser,
  DocStatus,
  DocumentRow,
  Priority,
  WorkflowQueueJob,
  WorkerEnv,
} from './worker/types.js';

const PRIORITIES: Priority[] = ['NORMAL', 'URGENT', 'FLASH'];

function jsonResponse(body: unknown, status = 200, extraHeaders?: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...(extraHeaders ?? {}),
    },
  });
}

function withCors(request: Request, env: WorkerEnv, response: Response): Response {
  const headers = new Headers(response.headers);
  const requestOrigin = request.headers.get('origin');
  const trustedOrigins = (env.BETTER_AUTH_TRUSTED_ORIGINS ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter((value) => value.length > 0);

  if (requestOrigin) {
    const isTrusted = trustedOrigins.length === 0 || trustedOrigins.includes(requestOrigin);
    if (isTrusted) {
      headers.set('Access-Control-Allow-Origin', requestOrigin);
      headers.set('Access-Control-Allow-Credentials', 'true');
    }
    headers.set('Vary', 'Origin');
  } else {
    headers.set('Access-Control-Allow-Origin', '*');
  }

  headers.set('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-correlation-id');
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function parseExtractedData(serialized: string | null): Record<string, unknown> | null {
  if (!serialized) {
    return null;
  }

  try {
    return JSON.parse(serialized) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function toDocumentResponse(row: DocumentRow): Record<string, unknown> {
  return {
    id: row.id,
    trackingCode: row.tracking_code,
    submitterId: row.submitter_id,
    priority: row.priority,
    status: row.status,
    rawFileUrl: row.raw_file_url,
    redactedFileUrl: row.redacted_file_url,
    extractedData: parseExtractedData(row.extracted_data),
    aiConfidence: row.ai_confidence,
    securityLevel: row.security_level,
    slaDeadline: row.sla_deadline,
    assignedDept: row.assigned_dept,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function sanitizeFileName(fileName: string): string {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
}

function buildRawFileUrl(env: WorkerEnv, objectKey: string): string {
  const base = env.R2_PUBLIC_BASE_URL?.replace(/\/$/, '');
  if (!base) {
    return `r2://documents/${objectKey}`;
  }
  return `${base}/${objectKey}`;
}

function buildPublishedFileUrl(env: WorkerEnv, documentId: string): string {
  const base = env.R2_PUBLISHED_PUBLIC_BASE_URL?.replace(/\/$/, '');
  if (!base) {
    return `r2://published/${documentId}/result.json`;
  }
  return `${base}/${documentId}/result.json`;
}

function getUserRoles(user: AuthenticatedUser | null): string[] {
  return user?.realm_access?.roles ?? [];
}

function canActOnTask(userRoles: string[], requiredRole: string): boolean {
  if (userRoles.includes('ADMIN') || userRoles.includes('LANH_DAO') || userRoles.includes('QUAN_LY')) {
    return true;
  }
  return userRoles.includes(requiredRole);
}

async function parseJsonObject(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const body = await request.json();
    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
      return null;
    }
    return body as Record<string, unknown>;
  } catch {
    return null;
  }
}

async function applyDocumentDecision(
  env: WorkerEnv,
  options: {
    documentId: string;
    approved: boolean;
    reason: string;
    actor: string;
    correlationId: string;
  },
): Promise<{ status: number; body: Record<string, unknown> }> {
  const doc = await getDocumentById(env, options.documentId);
  if (!doc) {
    return { status: 404, body: { error: 'Document not found' } };
  }

  const extractedData = parseExtractedData(doc.extracted_data) ?? {};

  if (options.approved) {
    const publishedFileUrl = buildPublishedFileUrl(env, options.documentId);
    await updateDocumentDecision(env, {
      documentId: options.documentId,
      status: 'PUBLISHED',
      extractedData: {
        ...extractedData,
        approvedBy: options.actor,
        approvedAt: new Date().toISOString(),
        publishedFileUrl,
      },
    });

    await resolveOpenTasksByType(env, {
      documentId: options.documentId,
      taskType: 'LEADER_APPROVAL',
      resolutionData: { approved: true, approvedBy: options.actor },
    });

    await env.WORKFLOW_QUEUE.send({
      type: 'send-notification',
      recipientId: doc.submitter_id,
      subject: `Ho so ${doc.tracking_code} da duoc phe duyet`,
      body: `Ho so da duoc phe duyet boi ${options.actor}. Ket qua da duoc phat hanh.`,
      correlationId: options.correlationId,
    });

    await insertAuditLog(env, {
      documentId: options.documentId,
      action: 'DOCUMENT_APPROVED',
      actorId: options.actor,
      actorRole: 'LANH_DAO',
      correlationId: options.correlationId,
      metadata: { publishedFileUrl },
    });

    return { status: 200, body: { message: 'Document approved' } };
  }

  await updateDocumentDecision(env, {
    documentId: options.documentId,
    status: 'REJECTED',
    extractedData: {
      ...extractedData,
      rejectionReason: options.reason,
      rejectedBy: options.actor,
    },
  });

  await resolveOpenTasksByType(env, {
    documentId: options.documentId,
    taskType: 'LEADER_APPROVAL',
    resolutionData: { approved: false, reason: options.reason, rejectedBy: options.actor },
  });

  await createHitlTaskIfMissing(env, {
    documentId: options.documentId,
    taskType: 'THU_KY_REVIEW',
    assignedRole: 'THU_KY',
  });

  await env.WORKFLOW_QUEUE.send({
    type: 'send-notification',
    recipientId: doc.submitter_id,
    subject: `Ho so ${doc.tracking_code} bi tu choi`,
    body: `Ly do tu choi: ${options.reason}`,
    correlationId: options.correlationId,
  });

  await insertAuditLog(env, {
    documentId: options.documentId,
    action: 'DOCUMENT_REJECTED',
    actorId: options.actor,
    actorRole: 'LANH_DAO',
    correlationId: options.correlationId,
    metadata: { reason: options.reason },
  });

  return { status: 200, body: { message: 'Document rejected' } };
}

async function handleDocumentSubmit(request: Request, env: WorkerEnv): Promise<Response> {
  const auth = await authenticateRequest(request, env, { required: false });
  if (auth instanceof Response) {
    return auth;
  }

  const formData = await request.formData();
  const maybeFile = formData.get('file');
  if (!(maybeFile instanceof File)) {
    return jsonResponse({ error: 'File is required' }, 400);
  }

  const priorityRaw = String(formData.get('priority') ?? 'NORMAL').toUpperCase();
  if (!PRIORITIES.includes(priorityRaw as Priority)) {
    return jsonResponse({ error: 'Invalid priority' }, 400);
  }

  const maxFileSizeMb = Number(env.MAX_FILE_SIZE_MB ?? '50');
  if (maybeFile.size > maxFileSizeMb * 1024 * 1024) {
    return jsonResponse({ error: `File exceeds ${maxFileSizeMb}MB limit` }, 400);
  }

  const submitterId = auth?.sub ?? 'anonymous';
  const documentId = crypto.randomUUID();
  const trackingCode = `DVC-${Date.now()}-${documentId.slice(0, 8).toUpperCase()}`;
  const objectKey = `${documentId}/${sanitizeFileName(maybeFile.name)}`;

  await env.DOCUMENTS_BUCKET.put(objectKey, await maybeFile.arrayBuffer(), {
    httpMetadata: {
      contentType: maybeFile.type || 'application/octet-stream',
    },
  });

  const rawFileUrl = buildRawFileUrl(env, objectKey);

  await createDocument(env, {
    id: documentId,
    trackingCode,
    submitterId,
    priority: priorityRaw as Priority,
    status: 'RECEIVED',
    rawFileKey: objectKey,
    rawFileUrl,
  });

  const correlationId = request.headers.get('x-correlation-id') ?? crypto.randomUUID();

  await env.WORKFLOW_QUEUE.send({
    type: 'process-document',
    documentId,
    trackingCode,
    submitterId,
    priority: priorityRaw as Priority,
    rawFileKey: objectKey,
    correlationId,
  });

  await incrementMetric(env, 'metrics:api:document_submit');

  return jsonResponse(
    {
      message: 'Document received. Processing has started.',
      documentId,
      trackingCode,
      status: 'RECEIVED',
    },
    202,
  );
}

async function handleDocumentsList(request: Request, env: WorkerEnv): Promise<Response> {
  const url = new URL(request.url);
  const status = url.searchParams.get('status') ?? undefined;
  const priority = url.searchParams.get('priority') ?? undefined;
  const pageRaw = Number(url.searchParams.get('page') ?? '1');
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : 1;

  const result = await listDocuments(env, {
    status,
    priority,
    page,
    pageSize: 10,
  });

  return jsonResponse({
    documents: result.documents.map(toDocumentResponse),
    total: result.total,
  });
}

async function handleDocumentById(documentId: string, env: WorkerEnv): Promise<Response> {
  const doc = await getDocumentById(env, documentId);
  if (!doc) {
    return jsonResponse({ error: 'Document not found' }, 404);
  }

  return jsonResponse(toDocumentResponse(doc));
}

async function handleDocumentByTrackingCode(trackingCode: string, env: WorkerEnv): Promise<Response> {
  const doc = await getDocumentByTrackingCode(env, trackingCode);
  if (!doc) {
    return jsonResponse({ error: 'Document not found' }, 404);
  }

  return jsonResponse(toDocumentResponse(doc));
}

async function handleDocumentApproval(
  request: Request,
  env: WorkerEnv,
  documentId: string,
): Promise<Response> {
  const auth = await authenticateRequest(request, env, { required: true });
  if (auth instanceof Response) {
    return auth;
  }

  const body = await parseJsonObject(request);
  if (!body || typeof body.approved !== 'boolean') {
    return jsonResponse({ error: 'Field "approved" must be a boolean' }, 400);
  }

  const approved = body.approved;
  const reason = typeof body.reason === 'string' ? body.reason : 'Rejected by leader';
  const actor = auth?.preferred_username ?? auth?.sub ?? 'system';

  const result = await applyDocumentDecision(env, {
    documentId,
    approved,
    reason,
    actor,
    correlationId: request.headers.get('x-correlation-id') ?? crypto.randomUUID(),
  });

  return jsonResponse(result.body, result.status);
}

async function handleHitlTasksList(request: Request, env: WorkerEnv): Promise<Response> {
  const auth = await authenticateRequest(request, env, { required: true });
  if (auth instanceof Response) {
    return auth;
  }

  const tasks = await listActiveHitlTasks(env, getUserRoles(auth));
  return jsonResponse({ tasks });
}

async function handleHitlTaskById(request: Request, env: WorkerEnv, taskId: string): Promise<Response> {
  const auth = await authenticateRequest(request, env, { required: true });
  if (auth instanceof Response) {
    return auth;
  }

  const task = await getHitlTaskById(env, taskId);
  if (!task) {
    return jsonResponse({ error: 'Task not found' }, 404);
  }

  return jsonResponse(task);
}

async function handleHitlTaskClaim(request: Request, env: WorkerEnv, taskId: string): Promise<Response> {
  const auth = await authenticateRequest(request, env, { required: true });
  if (auth instanceof Response) {
    return auth;
  }

  const task = await getHitlTaskById(env, taskId);
  if (!task) {
    return jsonResponse({ error: 'Task not found' }, 404);
  }

  if (task.status !== 'PENDING') {
    return jsonResponse({ error: 'Task is not available for claiming' }, 409);
  }

  const roles = getUserRoles(auth);
  if (!canActOnTask(roles, task.assigned_role)) {
    return jsonResponse({ error: 'Insufficient role to claim this task' }, 403);
  }

  const userId = auth?.sub ?? 'unknown';
  await claimHitlTask(env, { taskId, userId });
  const updated = await getHitlTaskById(env, taskId);

  return jsonResponse(updated);
}

async function handleHitlTaskResolve(request: Request, env: WorkerEnv, taskId: string): Promise<Response> {
  const auth = await authenticateRequest(request, env, { required: true });
  if (auth instanceof Response) {
    return auth;
  }

  const body = await parseJsonObject(request);
  const resolutionData = body?.resolutionData;
  if (!resolutionData || typeof resolutionData !== 'object' || Array.isArray(resolutionData)) {
    return jsonResponse({ error: 'resolutionData must be an object' }, 400);
  }

  const task = await getHitlTaskById(env, taskId);
  if (!task) {
    return jsonResponse({ error: 'Task not found' }, 404);
  }

  const userId = auth?.sub ?? 'unknown';
  const userRoles = getUserRoles(auth);

  if (task.assigned_user_id && task.assigned_user_id !== userId && !canActOnTask(userRoles, task.assigned_role)) {
    return jsonResponse({ error: 'Not authorized to resolve this task' }, 403);
  }

  await resolveHitlTask(env, {
    taskId,
    resolutionData: resolutionData as Record<string, unknown>,
  });

  const correlationId = request.headers.get('x-correlation-id') ?? crypto.randomUUID();

  if (task.task_type === 'AI_REVIEW') {
    const approved = Boolean((resolutionData as Record<string, unknown>).approved);
    if (approved) {
      await updateDocumentStatus(env, task.document_id, 'VALIDATED');
      await createHitlTaskIfMissing(env, {
        documentId: task.document_id,
        taskType: 'LEADER_APPROVAL',
        assignedRole: 'LANH_DAO',
      });
    } else {
      await updateDocumentStatus(env, task.document_id, 'REJECTED');
    }
  }

  if (task.task_type === 'LEADER_APPROVAL') {
    const approved = Boolean((resolutionData as Record<string, unknown>).approved);
    const reason = String((resolutionData as Record<string, unknown>).reason ?? 'Rejected by leader');

    const result = await applyDocumentDecision(env, {
      documentId: task.document_id,
      approved,
      reason,
      actor: userId,
      correlationId,
    });

    if (result.status >= 400) {
      return jsonResponse(result.body, result.status);
    }
  }

  if (task.task_type === 'MANAGER_ESCALATION') {
    await updateDocumentStatus(env, task.document_id, 'VALIDATED');
  }

  await insertAuditLog(env, {
    documentId: task.document_id,
    action: 'HITL_TASK_RESOLVED',
    actorId: userId,
    actorRole: userRoles[0] ?? 'UNKNOWN',
    correlationId,
    metadata: {
      taskType: task.task_type,
      taskId,
      resolutionData,
    },
  });

  return jsonResponse({ message: 'Task resolved successfully', taskId });
}

async function handleAiChat(request: Request, env: WorkerEnv): Promise<Response> {
  const auth = await authenticateRequest(request, env, { required: true });
  if (auth instanceof Response) {
    return auth;
  }

  const body = await parseJsonObject(request);
  if (!body) {
    return jsonResponse({ error: 'Invalid request body' }, 400);
  }

  const documentId = body.documentId;
  const message = body.message;

  if (typeof documentId !== 'string' || typeof message !== 'string' || message.trim().length === 0) {
    return jsonResponse({ error: 'documentId and message are required' }, 400);
  }

  const doc = await getDocumentById(env, documentId);
  if (!doc) {
    return jsonResponse({ error: 'Document not found' }, 404);
  }

  const extracted = parseExtractedData(doc.extracted_data);
  const summary = typeof extracted?.summary === 'string' ? extracted.summary : 'No extracted summary available yet.';

  return jsonResponse({
    response: `Document ${doc.tracking_code}: ${summary}`,
    note: 'This endpoint currently returns contextual summary. LLM chat integration can be added in the next step.',
  });
}

async function handleAiReAnalyze(request: Request, env: WorkerEnv): Promise<Response> {
  const auth = await authenticateRequest(request, env, { required: true });
  if (auth instanceof Response) {
    return auth;
  }

  const body = await parseJsonObject(request);
  const documentId = body?.documentId;

  if (typeof documentId !== 'string') {
    return jsonResponse({ error: 'documentId is required' }, 400);
  }

  const doc = await getDocumentById(env, documentId);
  if (!doc) {
    return jsonResponse({ error: 'Document not found' }, 404);
  }

  const correlationId = request.headers.get('x-correlation-id') ?? crypto.randomUUID();
  await env.WORKFLOW_QUEUE.send({
    type: 'process-document',
    documentId: doc.id,
    trackingCode: doc.tracking_code,
    submitterId: doc.submitter_id,
    priority: doc.priority as Priority,
    rawFileKey: doc.raw_file_key,
    correlationId,
  });

  return jsonResponse({ status: 'success', message: 'Re-analysis queued' });
}

function notFound(): Response {
  return jsonResponse({ error: 'Not found' }, 404);
}

async function handleRequest(request: Request, env: WorkerEnv): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method.toUpperCase();

  if (method === 'OPTIONS') {
    return new Response(null, { status: 204 });
  }

  if ((method === 'GET' || method === 'POST') && path.startsWith('/api/auth')) {
    return getAuth(env).handler(request);
  }

  if (method === 'GET' && path === '/health') {
    return jsonResponse({ status: 'ok', service: 'core-api-worker' });
  }

  if (method === 'POST' && path === '/api/documents') {
    return handleDocumentSubmit(request, env);
  }

  if (method === 'GET' && path === '/api/documents') {
    return handleDocumentsList(request, env);
  }

  const documentByIdMatch = path.match(/^\/api\/documents\/id\/([^/]+)$/);
  if (method === 'GET' && documentByIdMatch) {
    return handleDocumentById(documentByIdMatch[1], env);
  }

  const approveMatch = path.match(/^\/api\/documents\/([^/]+)\/approve$/);
  if (method === 'POST' && approveMatch) {
    return handleDocumentApproval(request, env, approveMatch[1]);
  }

  const taskClaimMatch = path.match(/^\/api\/hitl\/tasks\/([^/]+)\/claim$/);
  if (method === 'POST' && taskClaimMatch) {
    return handleHitlTaskClaim(request, env, taskClaimMatch[1]);
  }

  const taskResolveMatch = path.match(/^\/api\/hitl\/tasks\/([^/]+)\/resolve$/);
  if (method === 'POST' && taskResolveMatch) {
    return handleHitlTaskResolve(request, env, taskResolveMatch[1]);
  }

  if (method === 'GET' && path === '/api/hitl/tasks') {
    return handleHitlTasksList(request, env);
  }

  const taskByIdMatch = path.match(/^\/api\/hitl\/tasks\/([^/]+)$/);
  if (method === 'GET' && taskByIdMatch) {
    return handleHitlTaskById(request, env, taskByIdMatch[1]);
  }

  if (method === 'POST' && path === '/api/ai/chat') {
    return handleAiChat(request, env);
  }

  if (method === 'POST' && path === '/api/ai/re-analyze') {
    return handleAiReAnalyze(request, env);
  }

  const documentByTrackingMatch = path.match(/^\/api\/documents\/([^/]+)$/);
  if (method === 'GET' && documentByTrackingMatch) {
    return handleDocumentByTrackingCode(documentByTrackingMatch[1], env);
  }

  return notFound();
}

const worker: ExportedHandler<WorkerEnv, WorkflowQueueJob> = {
  async fetch(request, env): Promise<Response> {
    try {
      const response = await handleRequest(request, env);
      return withCors(request, env, response);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return withCors(request, env, jsonResponse({ error: 'Internal server error', detail: message }, 500));
    }
  },

  async queue(batch, env): Promise<void> {
    for (const message of batch.messages) {
      try {
        await processWorkflowJob(env, message.body);
        message.ack();
      } catch {
        message.retry();
      }
    }
  },

  async scheduled(_controller, env): Promise<void> {
    await processDueScheduledJobs(env);
  },
};

export default worker;
