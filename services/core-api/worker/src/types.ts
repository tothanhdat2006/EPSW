export type PriorityValue = 'NORMAL' | 'URGENT' | 'FLASH';

export type DocumentStatus =
  | 'RECEIVED'
  | 'PROCESSING'
  | 'HITL_REVIEW'
  | 'VALIDATED'
  | 'REJECTED'
  | 'APPROVED'
  | 'PUBLISHED';

export type SecurityLevel =
  | 'UNCLASSIFIED'
  | 'RESTRICTED'
  | 'CONFIDENTIAL'
  | 'SECRET';

export type HitlTaskStatus = 'PENDING' | 'IN_PROGRESS' | 'RESOLVED';

export interface DocumentRecord {
  id: string;
  trackingCode: string;
  submitterId: string;
  priority: PriorityValue;
  status: DocumentStatus;
  rawFileUrl: string;
  redactedFileUrl: string | null;
  extractedData: Record<string, unknown> | null;
  aiConfidence: number | null;
  securityLevel: SecurityLevel;
  assignedDept: string | null;
  slaDeadline: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface HitlTaskRecord {
  id: string;
  documentId: string;
  taskType: string;
  assignedRole: string;
  assignedUserId: string | null;
  status: HitlTaskStatus;
  resolutionData: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
}

export interface AuthenticatedUser {
  sub: string;
  preferred_username?: string;
  email?: string;
  realm_access?: {
    roles?: string[];
  };
}

export interface ProcessDocumentJob {
  documentId: string;
  trackingCode: string;
  rawFileUrl: string;
  mimeType: string;
  submitterId: string;
  priority: PriorityValue;
  correlationId: string;
}

export interface NotificationJob {
  recipientId: string;
  subject: string;
  body: string;
  correlationId: string;
}

export type WorkflowQueueMessage =
  | {
      type: 'process-document';
      payload: ProcessDocumentJob;
    }
  | {
      type: 'send-notification';
      payload: NotificationJob;
    };

export interface WorkerAppVariables {
  correlationId: string;
  user?: AuthenticatedUser;
}
