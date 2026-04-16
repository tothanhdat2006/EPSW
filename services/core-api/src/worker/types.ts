export type Priority = 'NORMAL' | 'URGENT' | 'FLASH';

export type DocStatus =
  | 'RECEIVED'
  | 'PROCESSING'
  | 'HITL_REVIEW'
  | 'VALIDATED'
  | 'REJECTED'
  | 'APPROVED'
  | 'PUBLISHED';

export type HitlTaskStatus = 'PENDING' | 'IN_PROGRESS' | 'RESOLVED';

export interface AuthenticatedUser {
  sub: string;
  preferred_username?: string;
  email?: string;
  realm_access?: { roles: string[] };
}

export interface WorkerEnv {
  DB: D1Database;
  DOCUMENTS_BUCKET: R2Bucket;
  REDACTED_BUCKET: R2Bucket;
  PUBLISHED_BUCKET: R2Bucket;
  WORKFLOW_QUEUE: Queue<WorkflowQueueJob>;

  NODE_ENV?: string;
  BETTER_AUTH_SECRET?: string;
  BETTER_AUTH_URL?: string;
  BETTER_AUTH_TRUSTED_ORIGINS?: string;

  R2_PUBLIC_BASE_URL?: string;
  R2_PUBLISHED_PUBLIC_BASE_URL?: string;

  MAX_FILE_SIZE_MB?: string;
  CONFIDENCE_THRESHOLD?: string;

  UPSTASH_REDIS_REST_URL?: string;
  UPSTASH_REDIS_REST_TOKEN?: string;
}

export interface ProcessDocumentJob {
  type: 'process-document';
  documentId: string;
  trackingCode: string;
  submitterId: string;
  priority: Priority;
  rawFileKey: string;
  correlationId: string;
}

export interface SendNotificationJob {
  type: 'send-notification';
  recipientId: string;
  subject: string;
  body: string;
  correlationId: string;
}

export type WorkflowQueueJob = ProcessDocumentJob | SendNotificationJob;

export interface DocumentRow {
  id: string;
  tracking_code: string;
  submitter_id: string;
  priority: Priority;
  status: DocStatus;
  raw_file_key: string;
  raw_file_url: string;
  redacted_file_url: string | null;
  extracted_data: string | null;
  ai_confidence: number | null;
  security_level: string;
  sla_deadline: string | null;
  assigned_dept: string | null;
  created_at: string;
  updated_at: string;
}

export interface HitlTaskRow {
  id: string;
  document_id: string;
  task_type: string;
  assigned_role: string;
  assigned_user_id: string | null;
  status: HitlTaskStatus;
  resolution_data: string | null;
  created_at: string;
  resolved_at: string | null;

  tracking_code?: string;
  document_priority?: string;
  document_sla_deadline?: string | null;
  document_created_at?: string;
}

export interface ScheduledJobRow {
  id: string;
  job_type: string;
  payload_json: string;
  run_at: string;
  attempts: number;
  max_attempts: number;
  last_error: string | null;
}
