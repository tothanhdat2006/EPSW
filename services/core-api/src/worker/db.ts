import type {
  DocStatus,
  DocumentRow,
  HitlTaskRow,
  Priority,
  ScheduledJobRow,
  WorkerEnv,
} from './types.js';

export interface CreateDocumentInput {
  id: string;
  trackingCode: string;
  submitterId: string;
  priority: Priority;
  status: DocStatus;
  rawFileKey: string;
  rawFileUrl: string;
}

export interface UpdateDocumentValidationInput {
  documentId: string;
  extractedData: Record<string, unknown>;
  aiConfidence: number;
  securityLevel: string;
  assignedDept: string;
  slaDeadline: string;
  status: DocStatus;
}

export interface ScheduleJobInput {
  id: string;
  jobType: string;
  payloadJson: string;
  runAt: string;
  maxAttempts: number;
}

function nowIso(): string {
  return new Date().toISOString();
}

export async function createDocument(env: WorkerEnv, input: CreateDocumentInput): Promise<void> {
  await env.DB.prepare(
    `
      INSERT INTO documents (
        id,
        tracking_code,
        submitter_id,
        priority,
        status,
        raw_file_key,
        raw_file_url,
        security_level,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'UNCLASSIFIED', ?, ?)
    `,
  )
    .bind(
      input.id,
      input.trackingCode,
      input.submitterId,
      input.priority,
      input.status,
      input.rawFileKey,
      input.rawFileUrl,
      nowIso(),
      nowIso(),
    )
    .run();
}

export async function listDocuments(
  env: WorkerEnv,
  options: { status?: string; priority?: string; page: number; pageSize: number },
): Promise<{ documents: DocumentRow[]; total: number }> {
  const where: string[] = [];
  const bindings: Array<string | number> = [];

  if (options.status) {
    where.push('status = ?');
    bindings.push(options.status);
  }

  if (options.priority) {
    where.push('priority = ?');
    bindings.push(options.priority);
  }

  const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
  const offset = (options.page - 1) * options.pageSize;

  const listResult = await env.DB.prepare(
    `
      SELECT
        id,
        tracking_code,
        submitter_id,
        priority,
        status,
        raw_file_key,
        raw_file_url,
        redacted_file_url,
        extracted_data,
        ai_confidence,
        security_level,
        sla_deadline,
        assigned_dept,
        created_at,
        updated_at
      FROM documents
      ${whereSql}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `,
  )
    .bind(...bindings, options.pageSize, offset)
    .all<DocumentRow>();

  const countResult = await env.DB.prepare(
    `
      SELECT COUNT(*) AS total
      FROM documents
      ${whereSql}
    `,
  )
    .bind(...bindings)
    .first<{ total: number }>();

  return {
    documents: listResult.results ?? [],
    total: Number(countResult?.total ?? 0),
  };
}

export async function getDocumentById(env: WorkerEnv, id: string): Promise<DocumentRow | null> {
  const row = await env.DB.prepare(
    `
      SELECT
        id,
        tracking_code,
        submitter_id,
        priority,
        status,
        raw_file_key,
        raw_file_url,
        redacted_file_url,
        extracted_data,
        ai_confidence,
        security_level,
        sla_deadline,
        assigned_dept,
        created_at,
        updated_at
      FROM documents
      WHERE id = ?
    `,
  )
    .bind(id)
    .first<DocumentRow>();

  return row ?? null;
}

export async function getDocumentByTrackingCode(
  env: WorkerEnv,
  trackingCode: string,
): Promise<DocumentRow | null> {
  const row = await env.DB.prepare(
    `
      SELECT
        id,
        tracking_code,
        submitter_id,
        priority,
        status,
        raw_file_key,
        raw_file_url,
        redacted_file_url,
        extracted_data,
        ai_confidence,
        security_level,
        sla_deadline,
        assigned_dept,
        created_at,
        updated_at
      FROM documents
      WHERE tracking_code = ?
    `,
  )
    .bind(trackingCode)
    .first<DocumentRow>();

  return row ?? null;
}

export async function updateDocumentStatus(
  env: WorkerEnv,
  documentId: string,
  status: DocStatus,
): Promise<void> {
  await env.DB.prepare(
    `
      UPDATE documents
      SET status = ?, updated_at = ?
      WHERE id = ?
    `,
  )
    .bind(status, nowIso(), documentId)
    .run();
}

export async function updateDocumentValidation(
  env: WorkerEnv,
  input: UpdateDocumentValidationInput,
): Promise<void> {
  await env.DB.prepare(
    `
      UPDATE documents
      SET
        status = ?,
        extracted_data = ?,
        ai_confidence = ?,
        security_level = ?,
        assigned_dept = ?,
        sla_deadline = ?,
        updated_at = ?
      WHERE id = ?
    `,
  )
    .bind(
      input.status,
      JSON.stringify(input.extractedData),
      input.aiConfidence,
      input.securityLevel,
      input.assignedDept,
      input.slaDeadline,
      nowIso(),
      input.documentId,
    )
    .run();
}

export async function updateDocumentDecision(
  env: WorkerEnv,
  options: {
    documentId: string;
    status: DocStatus;
    extractedData: Record<string, unknown>;
  },
): Promise<void> {
  await env.DB.prepare(
    `
      UPDATE documents
      SET
        status = ?,
        extracted_data = ?,
        updated_at = ?
      WHERE id = ?
    `,
  )
    .bind(options.status, JSON.stringify(options.extractedData), nowIso(), options.documentId)
    .run();
}

export async function createHitlTaskIfMissing(
  env: WorkerEnv,
  options: {
    documentId: string;
    taskType: string;
    assignedRole: string;
  },
): Promise<void> {
  const existing = await env.DB.prepare(
    `
      SELECT id
      FROM hitl_tasks
      WHERE document_id = ?
        AND task_type = ?
        AND status IN ('PENDING', 'IN_PROGRESS')
      LIMIT 1
    `,
  )
    .bind(options.documentId, options.taskType)
    .first<{ id: string }>();

  if (existing) {
    return;
  }

  await env.DB.prepare(
    `
      INSERT INTO hitl_tasks (
        id,
        document_id,
        task_type,
        assigned_role,
        status,
        created_at
      ) VALUES (?, ?, ?, ?, 'PENDING', ?)
    `,
  )
    .bind(crypto.randomUUID(), options.documentId, options.taskType, options.assignedRole, nowIso())
    .run();
}

export async function listActiveHitlTasks(
  env: WorkerEnv,
  userRoles: string[],
): Promise<HitlTaskRow[]> {
  const result = await env.DB.prepare(
    `
      SELECT
        t.id,
        t.document_id,
        t.task_type,
        t.assigned_role,
        t.assigned_user_id,
        t.status,
        t.resolution_data,
        t.created_at,
        t.resolved_at,
        d.tracking_code,
        d.priority AS document_priority,
        d.sla_deadline AS document_sla_deadline,
        d.created_at AS document_created_at
      FROM hitl_tasks t
      JOIN documents d ON d.id = t.document_id
      WHERE t.status IN ('PENDING', 'IN_PROGRESS')
      ORDER BY t.created_at ASC
    `,
  ).all<HitlTaskRow>();

  const tasks = result.results ?? [];

  if (userRoles.includes('ADMIN')) {
    return tasks;
  }

  if (userRoles.length === 0) {
    return [];
  }

  return tasks.filter((task) => userRoles.includes(task.assigned_role));
}

export async function getHitlTaskById(env: WorkerEnv, taskId: string): Promise<HitlTaskRow | null> {
  const row = await env.DB.prepare(
    `
      SELECT
        id,
        document_id,
        task_type,
        assigned_role,
        assigned_user_id,
        status,
        resolution_data,
        created_at,
        resolved_at
      FROM hitl_tasks
      WHERE id = ?
    `,
  )
    .bind(taskId)
    .first<HitlTaskRow>();

  return row ?? null;
}

export async function claimHitlTask(
  env: WorkerEnv,
  options: { taskId: string; userId: string },
): Promise<void> {
  await env.DB.prepare(
    `
      UPDATE hitl_tasks
      SET assigned_user_id = ?, status = 'IN_PROGRESS'
      WHERE id = ?
    `,
  )
    .bind(options.userId, options.taskId)
    .run();
}

export async function resolveHitlTask(
  env: WorkerEnv,
  options: { taskId: string; resolutionData: Record<string, unknown> },
): Promise<void> {
  await env.DB.prepare(
    `
      UPDATE hitl_tasks
      SET
        status = 'RESOLVED',
        resolution_data = ?,
        resolved_at = ?
      WHERE id = ?
    `,
  )
    .bind(JSON.stringify(options.resolutionData), nowIso(), options.taskId)
    .run();
}

export async function resolveOpenTasksByType(
  env: WorkerEnv,
  options: {
    documentId: string;
    taskType: string;
    resolutionData: Record<string, unknown>;
  },
): Promise<void> {
  await env.DB.prepare(
    `
      UPDATE hitl_tasks
      SET
        status = 'RESOLVED',
        resolution_data = ?,
        resolved_at = ?
      WHERE document_id = ?
        AND task_type = ?
        AND status IN ('PENDING', 'IN_PROGRESS')
    `,
  )
    .bind(JSON.stringify(options.resolutionData), nowIso(), options.documentId, options.taskType)
    .run();
}

export async function insertAuditLog(
  env: WorkerEnv,
  options: {
    documentId: string;
    action: string;
    actorId: string;
    actorRole: string;
    correlationId: string;
    metadata?: Record<string, unknown>;
  },
): Promise<void> {
  await env.DB.prepare(
    `
      INSERT INTO audit_logs (
        id,
        document_id,
        action,
        actor_id,
        actor_role,
        correlation_id,
        metadata,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
  )
    .bind(
      crypto.randomUUID(),
      options.documentId,
      options.action,
      options.actorId,
      options.actorRole,
      options.correlationId,
      options.metadata ? JSON.stringify(options.metadata) : null,
      nowIso(),
    )
    .run();
}

export async function scheduleJob(env: WorkerEnv, input: ScheduleJobInput): Promise<void> {
  await env.DB.prepare(
    `
      INSERT INTO scheduled_jobs (
        id,
        job_type,
        payload_json,
        run_at,
        max_attempts,
        attempts,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, 0, ?, ?)
    `,
  )
    .bind(input.id, input.jobType, input.payloadJson, input.runAt, input.maxAttempts, nowIso(), nowIso())
    .run();
}

export async function getDueScheduledJobs(
  env: WorkerEnv,
  limit = 25,
): Promise<ScheduledJobRow[]> {
  const result = await env.DB.prepare(
    `
      SELECT
        id,
        job_type,
        payload_json,
        run_at,
        attempts,
        max_attempts,
        last_error
      FROM scheduled_jobs
      WHERE run_at <= ?
      ORDER BY run_at ASC
      LIMIT ?
    `,
  )
    .bind(nowIso(), limit)
    .all<ScheduledJobRow>();

  return result.results ?? [];
}

export async function deleteScheduledJob(env: WorkerEnv, jobId: string): Promise<void> {
  await env.DB.prepare('DELETE FROM scheduled_jobs WHERE id = ?').bind(jobId).run();
}

export async function rescheduleScheduledJob(
  env: WorkerEnv,
  options: {
    jobId: string;
    attempts: number;
    nextRunAt: string;
    lastError: string;
  },
): Promise<void> {
  await env.DB.prepare(
    `
      UPDATE scheduled_jobs
      SET
        attempts = ?,
        run_at = ?,
        last_error = ?,
        updated_at = ?
      WHERE id = ?
    `,
  )
    .bind(options.attempts, options.nextRunAt, options.lastError, nowIso(), options.jobId)
    .run();
}
