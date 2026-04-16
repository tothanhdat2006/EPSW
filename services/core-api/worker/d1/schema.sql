PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  tracking_code TEXT NOT NULL UNIQUE,
  submitter_id TEXT NOT NULL,
  priority TEXT NOT NULL CHECK (priority IN ('NORMAL', 'URGENT', 'FLASH')),
  status TEXT NOT NULL CHECK (status IN ('RECEIVED', 'PROCESSING', 'HITL_REVIEW', 'VALIDATED', 'REJECTED', 'APPROVED', 'PUBLISHED')),
  raw_file_url TEXT NOT NULL,
  redacted_file_url TEXT,
  extracted_data TEXT,
  ai_confidence REAL,
  security_level TEXT NOT NULL DEFAULT 'UNCLASSIFIED' CHECK (security_level IN ('UNCLASSIFIED', 'RESTRICTED', 'CONFIDENTIAL', 'SECRET')),
  assigned_dept TEXT,
  sla_deadline TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status);
CREATE INDEX IF NOT EXISTS idx_documents_submitter_id ON documents(submitter_id);
CREATE INDEX IF NOT EXISTS idx_documents_sla_deadline ON documents(sla_deadline);

CREATE TABLE IF NOT EXISTS hitl_tasks (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL,
  task_type TEXT NOT NULL,
  assigned_role TEXT NOT NULL,
  assigned_user_id TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'IN_PROGRESS', 'RESOLVED')),
  resolution_data TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  resolved_at TEXT,
  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_hitl_tasks_document_id ON hitl_tasks(document_id);
CREATE INDEX IF NOT EXISTS idx_hitl_tasks_assigned_role_status ON hitl_tasks(assigned_role, status);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL,
  action TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  actor_role TEXT NOT NULL,
  correlation_id TEXT NOT NULL,
  metadata TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_document_id ON audit_logs(document_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_correlation_id ON audit_logs(correlation_id);

CREATE TABLE IF NOT EXISTS job_retries (
  id TEXT PRIMARY KEY,
  job_type TEXT NOT NULL,
  payload TEXT NOT NULL,
  retry_count INTEGER NOT NULL DEFAULT 0,
  next_run_at TEXT NOT NULL,
  last_error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_job_retries_next_run_at ON job_retries(next_run_at);

CREATE TABLE IF NOT EXISTS "user" (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  emailVerified INTEGER NOT NULL DEFAULT 0,
  image TEXT,
  role TEXT DEFAULT 'CITIZEN',
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS "session" (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  expiresAt TEXT NOT NULL,
  ipAddress TEXT,
  userAgent TEXT,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  FOREIGN KEY (userId) REFERENCES "user"(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_session_userId ON "session"(userId);

CREATE TABLE IF NOT EXISTS "account" (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL,
  accountId TEXT NOT NULL,
  providerId TEXT NOT NULL,
  accessToken TEXT,
  refreshToken TEXT,
  accessTokenExpiresAt TEXT,
  refreshTokenExpiresAt TEXT,
  scope TEXT,
  idToken TEXT,
  password TEXT,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  FOREIGN KEY (userId) REFERENCES "user"(id) ON DELETE CASCADE,
  UNIQUE (providerId, accountId)
);

CREATE INDEX IF NOT EXISTS idx_account_userId ON "account"(userId);

CREATE TABLE IF NOT EXISTS "verification" (
  id TEXT PRIMARY KEY,
  identifier TEXT NOT NULL,
  value TEXT NOT NULL,
  expiresAt TEXT NOT NULL,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_verification_identifier ON "verification"(identifier);
