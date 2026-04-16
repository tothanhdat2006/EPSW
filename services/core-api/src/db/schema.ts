import { sqliteTable, text, real, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

/**
 * Priorities for processing documents.
 */
export const priorityEnum = ['NORMAL', 'URGENT', 'FLASH'] as const;
export type Priority = (typeof priorityEnum)[number];

/**
 * Status levels for the document lifecycle.
 */
export const docStatusEnum = [
	'RECEIVED',
	'PROCESSING',
	'HITL_REVIEW',
	'VALIDATED',
	'REJECTED',
	'APPROVED',
	'PUBLISHED'
] as const;
export type DocStatus = (typeof docStatusEnum)[number];

/**
 * Security classification levels.
 */
export const securityLevelEnum = ['UNCLASSIFIED', 'RESTRICTED', 'CONFIDENTIAL', 'SECRET'] as const;
export type SecurityLevel = (typeof securityLevelEnum)[number];

// ─── Tables ──────────────────────────────────────────────────────────────────

export const documents = sqliteTable('document', {
	id: text('id').primaryKey(),
	trackingCode: text('tracking_code').notNull().unique(),
	submitterId: text('submitter_id').notNull(),
	citizenEmail: text('citizen_email'), // NEW FIELD for notifications
	priority: text('priority').notNull().default('NORMAL'),
	status: text('status').notNull().default('RECEIVED'),

	rawFileUrl: text('raw_file_url').notNull(),
	redactedFileUrl: text('redacted_file_url'),

	extractedData: text('extracted_data'), // JSON string
	aiConfidence: real('ai_confidence'),
	securityLevel: text('security_level').notNull().default('UNCLASSIFIED'),

	slaDeadline: integer('sla_deadline', { mode: 'timestamp' }),
	assignedDept: text('assigned_dept'),

	createdAt: integer('created_at', { mode: 'timestamp' })
		.notNull()
		.default(sql`(strftime('%s', 'now'))`),
	updatedAt: integer('updated_at', { mode: 'timestamp' })
		.notNull()
		.default(sql`(strftime('%s', 'now'))`)
});

export const hitlTasks = sqliteTable('hitl_task', {
	id: text('id').primaryKey(),
	documentId: text('document_id')
		.notNull()
		.references(() => documents.id),

	taskType: text('task_type').notNull(),
	assignedRole: text('assigned_role').notNull(),
	assignedUserId: text('assigned_user_id'),

	status: text('status').notNull().default('PENDING'),
	resolutionData: text('resolution_data'), // JSON string

	createdAt: integer('created_at', { mode: 'timestamp' })
		.notNull()
		.default(sql`(strftime('%s', 'now'))`),
	resolvedAt: integer('resolved_at', { mode: 'timestamp' })
});

export const auditLogs = sqliteTable('audit_log', {
	id: text('id').primaryKey(),
	documentId: text('document_id')
		.notNull()
		.references(() => documents.id),

	action: text('action').notNull(),
	actorId: text('actor_id').notNull(),
	actorRole: text('actor_role').notNull(),
	correlationId: text('correlation_id').notNull(),
	metadata: text('metadata'), // JSON string

	createdAt: integer('created_at', { mode: 'timestamp' })
		.notNull()
		.default(sql`(strftime('%s', 'now'))`)
});
