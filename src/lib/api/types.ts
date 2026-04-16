// ─── Shared API types ────────────────────────────────────────────────────────

export interface DocumentSummary {
	id: string;
	trackingCode: string;
	status: string;
	priority: string;
	securityLevel: string;
	aiConfidence?: number;
	slaDeadline?: string;
	rawFileUrl?: string;
	redactedFileUrl?: string;
	createdAt: string;
	updatedAt: string;
	extractedData?: Record<string, unknown>;
}

export interface HitlTask {
	id: string;
	documentId: string;
	taskType: string;
	assignedRole: string;
	status: string;
	createdAt: string;
	document?: {
		trackingCode: string;
		priority: string;
		slaDeadline?: string;
	};
}

export type Priority = 'NORMAL' | 'URGENT' | 'FLASH';
