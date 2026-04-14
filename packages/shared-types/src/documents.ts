export enum Priority {
  NORMAL = 'NORMAL',
  URGENT = 'URGENT',
  FLASH = 'FLASH',
}

export enum DocStatus {
  RECEIVED = 'RECEIVED',
  PROCESSING = 'PROCESSING',
  HITL_REVIEW = 'HITL_REVIEW',
  VALIDATED = 'VALIDATED',
  REJECTED = 'REJECTED',
  APPROVED = 'APPROVED',
  PUBLISHED = 'PUBLISHED',
}

export enum HitlTaskType {
  OCR_FIX = 'OCR_FIX',
  AI_REVIEW = 'AI_REVIEW',
  MANAGER_ESCALATION = 'MANAGER_ESCALATION',
  PRINT_ISSUE = 'PRINT_ISSUE',
}

export enum HitlTaskStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  RESOLVED = 'RESOLVED',
}

export enum AssignedRole {
  VAN_THU = 'VAN_THU',
  CHUYEN_VIEN = 'CHUYEN_VIEN',
  QUAN_LY = 'QUAN_LY',
  LANH_DAO = 'LANH_DAO',
  THU_KY = 'THU_KY',
}

export enum SecurityLevel {
  UNCLASSIFIED = 'UNCLASSIFIED',
  RESTRICTED = 'RESTRICTED',
  CONFIDENTIAL = 'CONFIDENTIAL',
  SECRET = 'SECRET',
}

export interface Document {
  id: string;
  trackingCode: string;
  submitterId: string;
  priority: Priority;
  status: DocStatus;
  rawFileUrl: string;
  redactedFileUrl?: string | null;
  extractedData?: Record<string, unknown> | null;
  aiConfidence?: number | null;
  slaDeadline?: Date | null;
  createdAt: Date;
  updatedAt: Date;
  hitlTasks?: HitlTask[];
}

export interface HitlTask {
  id: string;
  documentId: string;
  document?: Document;
  taskType: HitlTaskType;
  assignedRole: AssignedRole;
  assignedUserId?: string | null;
  status: HitlTaskStatus;
  resolutionData?: Record<string, unknown> | null;
  createdAt: Date;
  resolvedAt?: Date | null;
}

export interface ExtractedDocumentData {
  documentType: string;
  issuingAuthority?: string;
  issueDate?: string;
  expiryDate?: string;
  subjectName?: string;
  subjectId?: string;
  summary?: string;
  keywords?: string[];
  securityLevel: SecurityLevel;
  rawText?: string;
  [key: string]: unknown;
}
