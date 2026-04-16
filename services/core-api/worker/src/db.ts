import type {
  DocumentRecord,
  DocumentStatus,
  HitlTaskRecord,
  HitlTaskStatus,
  PriorityValue,
  SecurityLevel,
} from './types.js';

interface DocumentRow {
  id: string;
  tracking_code: string;
  submitter_id: string;
  priority: PriorityValue;
  status: DocumentStatus;
  raw_file_url: string;
  redacted_file_url: string | null;
  extracted_data: string | null;
  ai_confidence: number | null;
  security_level: SecurityLevel;
  assigned_dept: string | null;
  sla_deadline: string | null;
  created_at: string;
  updated_at: string;
}

interface HitlTaskRow {
  id: string;
  document_id: string;
  task_type: string;
  assigned_role: string;
  assigned_user_id: string | null;
  status: HitlTaskStatus;
  resolution_data: string | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
}

export interface CreateDocumentInput {
  id: string;
  trackingCode: string;
  submitterId: string;
  priority: PriorityValue;
  status?: DocumentStatus;
  rawFileUrl: string;
}

export interface ListDocumentsInput {
  status?: string;
  priority?: string;
  page?: number;
  pageSize?: number;
}

export interface DocumentListResult {
  documents: DocumentRecord[];
  total: number;
}

function nowIso(): string {
  return new Date().toISOString();
}

function parseJsonColumn(value: string | null): Record<string, unknown> | null {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    if (parsed && typeof parsed === 'object') {
      return parsed as Record<string, unknown>;
    }
    return null;
  } catch {
    return null;
  }
}

function mapDocument(row: DocumentRow): DocumentRecord {
  return {
    id: row.id,
    trackingCode: row.tracking_code,
    submitterId: row.submitter_id,
    priority: row.priority,
    status: row.status,
    rawFileUrl: row.raw_file_url,
    redactedFileUrl: row.redacted_file_url,
    extractedData: parseJsonColumn(row.extracted_data),
    aiConfidence: row.ai_confidence,
    securityLevel: row.security_level,
    assignedDept: row.assigned_dept,
    slaDeadline: row.sla_deadline,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapHitlTask(row: HitlTaskRow): HitlTaskRecord {
  return {
    id: row.id,
    documentId: row.document_id,
    taskType: row.task_type,
    assignedRole: row.assigned_role,
    assignedUserId: row.assigned_user_id,
    status: row.status,
    resolutionData: parseJsonColumn(row.resolution_data),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    resolvedAt: row.resolved_at,
  };
}

export async function createDocument(
  db: D1Database,
  input: CreateDocumentInput,
): Promise<DocumentRecord> {
  const createdAt = nowIso();
  await db
    .prepare(
      `
      INSERT INTO documents (
        id, tracking_code, submitter_id, priority, status,
        raw_file_url, security_level, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
    )
    .bind(
      input.id,
      input.trackingCode,
      input.submitterId,
      input.priority,
      input.status ?? 'RECEIVED',
      input.rawFileUrl,
      'UNCLASSIFIED',
      createdAt,
      createdAt,
    )
    .run();

  const record = await getDocumentById(db, input.id);
  if (!record) {
    throw new Error('Failed to create document');
  }
  return record;
}

export async function getDocumentById(
  db: D1Database,
  id: string,
): Promise<DocumentRecord | null> {
  const row = await db
    .prepare(
      `
      SELECT id, tracking_code, submitter_id, priority, status,
             raw_file_url, redacted_file_url, extracted_data,
             ai_confidence, security_level, assigned_dept,
             sla_deadline, created_at, updated_at
      FROM documents
      WHERE id = ?
      LIMIT 1
      `,
    )
    .bind(id)
    .first<DocumentRow>();

  return row ? mapDocument(row) : null;
}

export async function getDocumentByTrackingCode(
  db: D1Database,
  trackingCode: string,
): Promise<DocumentRecord | null> {
  const row = await db
    .prepare(
      `
      SELECT id, tracking_code, submitter_id, priority, status,
             raw_file_url, redacted_file_url, extracted_data,
             ai_confidence, security_level, assigned_dept,
             sla_deadline, created_at, updated_at
      FROM documents
      WHERE tracking_code = ?
      LIMIT 1
      `,
    )
    .bind(trackingCode)
    .first<DocumentRow>();

  return row ? mapDocument(row) : null;
}

export async function listDocuments(
  db: D1Database,
  input: ListDocumentsInput,
): Promise<DocumentListResult> {
  const where: string[] = [];
  const binds: Array<string> = [];

  if (input.status) {
    where.push('status = ?');
    binds.push(input.status);
  }

  if (input.priority) {
    where.push('priority = ?');
    binds.push(input.priority);
  }

  const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
  const pageSize = Math.max(1, Math.min(100, input.pageSize ?? 10));
  const page = Math.max(1, input.page ?? 1);
  const offset = (page - 1) * pageSize;

  const rowsResult = await db
    .prepare(
      `
      SELECT id, tracking_code, submitter_id, priority, status,
             raw_file_url, redacted_file_url, extracted_data,
             ai_confidence, security_level, assigned_dept,
             sla_deadline, created_at, updated_at
      FROM documents
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
      `,
    )
    .bind(...binds, pageSize, offset)
    .all<DocumentRow>();

  const countResult = await db
    .prepare(
      `
      SELECT COUNT(1) AS total
      FROM documents
      ${whereClause}
      `,
    )
    .bind(...binds)
    .first<{ total: number }>();

  return {
    documents: (rowsResult.results ?? []).map(mapDocument),
    total: Number(countResult?.total ?? 0),
  };
}

export async function setDocumentStatus(
  db: D1Database,
  documentId: string,
  status: DocumentStatus,
): Promise<void> {
  await db
    .prepare('UPDATE documents SET status = ?, updated_at = ? WHERE id = ?')
    .bind(status, nowIso(), documentId)
    .run();
}

export interface HitlReviewUpdate {
  extractedData: Record<string, unknown>;
  aiConfidence?: number;
  securityLevel?: SecurityLevel;
}

export async function setDocumentToHitlReview(
  db: D1Database,
  documentId: string,
  input: HitlReviewUpdate,
): Promise<void> {
  await db
    .prepare(
      `
      UPDATE documents
      SET status = ?,
          extracted_data = ?,
          ai_confidence = ?,
          security_level = ?,
          updated_at = ?
      WHERE id = ?
      `,
    )
    .bind(
      'HITL_REVIEW',
      JSON.stringify(input.extractedData),
      input.aiConfidence ?? null,
      input.securityLevel ?? 'UNCLASSIFIED',
      nowIso(),
      documentId,
    )
    .run();
}

export interface ValidatedUpdate {
  extractedData: Record<string, unknown>;
  aiConfidence: number;
  securityLevel: SecurityLevel;
  assignedDept: string;
  slaDeadline: string;
}

export async function setDocumentValidated(
  db: D1Database,
  documentId: string,
  input: ValidatedUpdate,
): Promise<void> {
  await db
    .prepare(
      `
      UPDATE documents
      SET status = ?,
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
      'VALIDATED',
      JSON.stringify(input.extractedData),
      input.aiConfidence,
      input.securityLevel,
      input.assignedDept,
      input.slaDeadline,
      nowIso(),
      documentId,
    )
    .run();
}

export async function ensureOpenHitlTask(
  db: D1Database,
  documentId: string,
  taskType: string,
  assignedRole: string,
): Promise<void> {
  const existing = await db
    .prepare(
      `
      SELECT id
      FROM hitl_tasks
      WHERE document_id = ?
        AND task_type = ?
        AND status IN ('PENDING', 'IN_PROGRESS')
      LIMIT 1
      `,
    )
    .bind(documentId, taskType)
    .first<{ id: string }>();

  if (existing?.id) {
    return;
  }

  const createdAt = nowIso();
  await db
    .prepare(
      `
      INSERT INTO hitl_tasks (
        id, document_id, task_type, assigned_role,
        status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
    )
    .bind(
      crypto.randomUUID(),
      documentId,
      taskType,
      assignedRole,
      'PENDING',
      createdAt,
      createdAt,
    )
    .run();
}

export async function listOpenHitlTasks(
  db: D1Database,
  userRoles: string[],
): Promise<Array<HitlTaskRecord & { trackingCode: string; priority: PriorityValue; slaDeadline: string | null }>> {
  const includeAll = userRoles.includes('ADMIN');
  const rolePlaceholders = userRoles.map(() => '?').join(', ');

  const sql = includeAll
    ? `
      SELECT t.id, t.document_id, t.task_type, t.assigned_role, t.assigned_user_id,
             t.status, t.resolution_data, t.created_at, t.updated_at, t.resolved_at,
             d.tracking_code, d.priority, d.sla_deadline
      FROM hitl_tasks t
      JOIN documents d ON d.id = t.document_id
      WHERE t.status IN ('PENDING', 'IN_PROGRESS')
      ORDER BY t.created_at ASC
      `
    : `
      SELECT t.id, t.document_id, t.task_type, t.assigned_role, t.assigned_user_id,
             t.status, t.resolution_data, t.created_at, t.updated_at, t.resolved_at,
             d.tracking_code, d.priority, d.sla_deadline
      FROM hitl_tasks t
      JOIN documents d ON d.id = t.document_id
      WHERE t.status IN ('PENDING', 'IN_PROGRESS')
        AND t.assigned_role IN (${rolePlaceholders})
      ORDER BY t.created_at ASC
      `;

  const rows = includeAll
    ? await db.prepare(sql).all<HitlTaskRow & { tracking_code: string; priority: PriorityValue; sla_deadline: string | null }>()
    : await db.prepare(sql).bind(...userRoles).all<HitlTaskRow & { tracking_code: string; priority: PriorityValue; sla_deadline: string | null }>();

  return (rows.results ?? []).map((row) => ({
    ...mapHitlTask(row),
    trackingCode: row.tracking_code,
    priority: row.priority,
    slaDeadline: row.sla_deadline,
  }));
}

export async function getHitlTaskById(
  db: D1Database,
  taskId: string,
): Promise<HitlTaskRecord | null> {
  const row = await db
    .prepare(
      `
      SELECT id, document_id, task_type, assigned_role, assigned_user_id,
             status, resolution_data, created_at, updated_at, resolved_at
      FROM hitl_tasks
      WHERE id = ?
      LIMIT 1
      `,
    )
    .bind(taskId)
    .first<HitlTaskRow>();

  return row ? mapHitlTask(row) : null;
}

export async function claimHitlTask(
  db: D1Database,
  taskId: string,
  userId: string,
): Promise<void> {
  await db
    .prepare(
      `
      UPDATE hitl_tasks
      SET assigned_user_id = ?, status = 'IN_PROGRESS', updated_at = ?
      WHERE id = ?
      `,
    )
    .bind(userId, nowIso(), taskId)
    .run();
}

export async function resolveHitlTask(
  db: D1Database,
  taskId: string,
  resolutionData: Record<string, unknown>,
): Promise<void> {
  const resolvedAt = nowIso();
  await db
    .prepare(
      `
      UPDATE hitl_tasks
      SET status = 'RESOLVED',
          resolution_data = ?,
          resolved_at = ?,
          updated_at = ?
      WHERE id = ?
      `,
    )
    .bind(JSON.stringify(resolutionData), resolvedAt, resolvedAt, taskId)
    .run();
}

export async function setDocumentPublished(
  db: D1Database,
  documentId: string,
  actor: string,
  publishedFileUrl: string,
): Promise<void> {
  const doc = await getDocumentById(db, documentId);
  if (!doc) {
    throw new Error('Document not found');
  }

  const extractedData = {
    ...(doc.extractedData ?? {}),
    approvedBy: actor,
    approvedAt: nowIso(),
    publishedFileUrl,
  };

  await db
    .prepare(
      `
      UPDATE documents
      SET status = 'PUBLISHED',
          extracted_data = ?,
          updated_at = ?
      WHERE id = ?
      `,
    )
    .bind(JSON.stringify(extractedData), nowIso(), documentId)
    .run();

  await db
    .prepare(
      `
      UPDATE hitl_tasks
      SET status = 'RESOLVED',
          resolution_data = ?,
          resolved_at = ?,
          updated_at = ?
      WHERE document_id = ?
        AND task_type = 'LEADER_APPROVAL'
        AND status IN ('PENDING', 'IN_PROGRESS')
      `,
    )
    .bind(JSON.stringify({ approved: true, approvedBy: actor }), nowIso(), nowIso(), documentId)
    .run();
}

export async function setDocumentRejected(
  db: D1Database,
  documentId: string,
  actor: string,
  reason: string,
): Promise<void> {
  const doc = await getDocumentById(db, documentId);
  if (!doc) {
    throw new Error('Document not found');
  }

  const extractedData = {
    ...(doc.extractedData ?? {}),
    rejectedBy: actor,
    rejectionReason: reason,
    rejectedAt: nowIso(),
  };

  await db
    .prepare(
      `
      UPDATE documents
      SET status = 'REJECTED',
          extracted_data = ?,
          updated_at = ?
      WHERE id = ?
      `,
    )
    .bind(JSON.stringify(extractedData), nowIso(), documentId)
    .run();

  await db
    .prepare(
      `
      UPDATE hitl_tasks
      SET status = 'RESOLVED',
          resolution_data = ?,
          resolved_at = ?,
          updated_at = ?
      WHERE document_id = ?
        AND task_type = 'LEADER_APPROVAL'
        AND status IN ('PENDING', 'IN_PROGRESS')
      `,
    )
    .bind(JSON.stringify({ approved: false, rejectedBy: actor, reason }), nowIso(), nowIso(), documentId)
    .run();
}

export async function insertAuditLog(
  db: D1Database,
  documentId: string,
  action: string,
  actorId: string,
  actorRole: string,
  correlationId: string,
  metadata?: Record<string, unknown>,
): Promise<void> {
  await db
    .prepare(
      `
      INSERT INTO audit_logs (
        id, document_id, action, actor_id, actor_role,
        correlation_id, metadata, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
    )
    .bind(
      crypto.randomUUID(),
      documentId,
      action,
      actorId,
      actorRole,
      correlationId,
      metadata ? JSON.stringify(metadata) : null,
      nowIso(),
    )
    .run();
}

export interface DueSlaDocument {
  id: string;
  trackingCode: string;
  submitterId: string;
}

export async function listDueSlaDocuments(
  db: D1Database,
  now: string,
): Promise<DueSlaDocument[]> {
  const rows = await db
    .prepare(
      `
      SELECT id, tracking_code, submitter_id
      FROM documents
      WHERE sla_deadline IS NOT NULL
        AND sla_deadline <= ?
        AND status IN ('RECEIVED', 'PROCESSING', 'VALIDATED', 'HITL_REVIEW')
      `,
    )
    .bind(now)
    .all<{ id: string; tracking_code: string; submitter_id: string }>();

  return (rows.results ?? []).map((row) => ({
    id: row.id,
    trackingCode: row.tracking_code,
    submitterId: row.submitter_id,
  }));
}

export async function escalateSlaBreach(
  db: D1Database,
  documentId: string,
): Promise<void> {
  await setDocumentStatus(db, documentId, 'HITL_REVIEW');
  await ensureOpenHitlTask(db, documentId, 'MANAGER_ESCALATION', 'QUAN_LY');
}
