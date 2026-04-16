import { DocStatus, HitlTaskType, AssignedRole, Priority, SecurityLevel } from './documents.js';

export interface BaseEvent {
  eventId: string;
  correlationId: string;
  timestamp: string;
  version: '1.0';
}

// ── core-api ingestion phase ────────────────────────────────────────────────
export interface DocumentReceivedEvent extends BaseEvent {
  type: 'document.received';
  payload: {
    documentId: string;
    trackingCode: string;
    submitterId: string;
    priority: Priority;
    rawFileUrl: string;
    fileName: string;
    mimeType: string;
    fileSizeBytes: number;
  };
}

// ── core-api parsing phase ──────────────────────────────────────────────────
export interface DocumentParsedEvent extends BaseEvent {
  type: 'document.parsed';
  payload: {
    documentId: string;
    trackingCode: string;
    rawText: string;
    pageCount: number;
    parseMethod: 'PDF_READER' | 'OCR' | 'HYBRID';
    receivedAt: string;
  };
}

// ── core-api AI analysis phase ──────────────────────────────────────────────
export interface DocumentAnalyzedEvent extends BaseEvent {
  type: 'document.analyzed';
  payload: {
    documentId: string;
    trackingCode: string;
    extractedData: Record<string, unknown>;
    aiConfidence: number;
    securityLevel: SecurityLevel;
    priority: Priority;
    redactedFileUrl?: string;
  };
}

// ── core-api validation phase ───────────────────────────────────────────────
export interface DocumentValidatedEvent extends BaseEvent {
  type: 'document.validated';
  payload: {
    documentId: string;
    trackingCode: string;
    submitterId: string;
    assignedDepartment: string;
    slaDeadline: string;
  };
}

export interface DocumentApprovedEvent extends BaseEvent {
  type: 'document.approved';
  payload: {
    documentId: string;
    trackingCode: string;
    submitterId: string;
    approvedBy: string;
    publishedFileUrl: string;
    summary: string;
  };
}

export interface DocumentRejectedEvent extends BaseEvent {
  type: 'document.rejected';
  payload: {
    documentId: string;
    trackingCode: string;
    submitterId: string;
    rejectedBy: string;
    rejectionReason: string;
    translatedReason?: string;
  };
}

// ── HITL events ───────────────────────────────────────────────────────────────
export interface HitlManualEntryRequiredEvent extends BaseEvent {
  type: 'hitl.manual_entry_required';
  payload: {
    documentId: string;
    trackingCode: string;
    rawFileUrl: string;
    errorReason: 'FONT_ERROR' | 'BLURRY_IMAGE' | 'ENCRYPTED' | 'UNREADABLE';
    assignedRole: AssignedRole;
  };
}

export interface HitlReviewRequiredEvent extends BaseEvent {
  type: 'hitl.review_required';
  payload: {
    documentId: string;
    trackingCode: string;
    aiConfidence: number;
    partialExtractedData: Record<string, unknown>;
    assignedRole: AssignedRole;
  };
}

export interface HitlPendingEvent extends BaseEvent {
  type: 'hitl.pending';
  payload: {
    documentId: string;
    trackingCode: string;
    taskType: HitlTaskType;
    assignedRole: AssignedRole;
    reason: string;
  };
}

export interface HitlEscalationEvent extends BaseEvent {
  type: 'hitl.escalation';
  payload: {
    documentId: string;
    trackingCode: string;
    slaDeadline: string;
    overdueByMinutes: number;
    assignedRole: AssignedRole.QUAN_LY;
  };
}

export interface HitlResolvedEvent extends BaseEvent {
  type: 'hitl.resolved';
  payload: {
    documentId: string;
    hitlTaskId: string;
    resolvedBy: string;
    resolutionData: Record<string, unknown>;
  };
}

// ── Notification events ───────────────────────────────────────────────────────
export interface NotificationSendEvent extends BaseEvent {
  type: 'notification.send';
  payload: {
    recipientId: string;
    channels: ('EMAIL' | 'SMS' | 'ZALO' | 'PORTAL')[];
    subject: string;
    body: string;
    documentId?: string;
    trackingCode?: string;
    newStatus?: DocStatus;
  };
}

export type WorkflowEvent =
  | DocumentReceivedEvent
  | DocumentParsedEvent
  | DocumentAnalyzedEvent
  | DocumentValidatedEvent
  | DocumentApprovedEvent
  | DocumentRejectedEvent
  | HitlManualEntryRequiredEvent
  | HitlReviewRequiredEvent
  | HitlPendingEvent
  | HitlEscalationEvent
  | HitlResolvedEvent
  | NotificationSendEvent;

export const WORKFLOW_EVENT_TYPES = {
  DOCUMENT_RECEIVED: 'document.received',
  DOCUMENT_PARSED: 'document.parsed',
  DOCUMENT_ANALYZED: 'document.analyzed',
  DOCUMENT_VALIDATED: 'document.validated',
  DOCUMENT_APPROVED: 'document.approved',
  DOCUMENT_REJECTED: 'document.rejected',
  HITL_MANUAL_ENTRY_REQUIRED: 'hitl.manual_entry_required',
  HITL_REVIEW_REQUIRED: 'hitl.review_required',
  HITL_PENDING: 'hitl.pending-topic',
  HITL_ESCALATION: 'hitl.escalation',
  HITL_RESOLVED: 'hitl.resolved',
  NOTIFICATION_SEND: 'notification.send',
} as const;
