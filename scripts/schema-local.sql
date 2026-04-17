-- Local D1 schema bootstrap (idempotent)
-- Run automatically on `pnpm dev` via scripts/setup-local-db.mjs

CREATE TABLE IF NOT EXISTS `user` (
  `id` text PRIMARY KEY NOT NULL,
  `name` text NOT NULL,
  `email` text NOT NULL UNIQUE,
  `email_verified` integer DEFAULT 0 NOT NULL,
  `image` text,
  `role` text DEFAULT 'mot_cua' NOT NULL,
  `department` text,
  `banned` integer DEFAULT 0,
  `ban_reason` text,
  `ban_expires` integer,
  `created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
  `updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);

CREATE TABLE IF NOT EXISTS `session` (
  `id` text PRIMARY KEY NOT NULL,
  `expires_at` integer NOT NULL,
  `token` text NOT NULL UNIQUE,
  `created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
  `updated_at` integer NOT NULL,
  `ip_address` text,
  `user_agent` text,
  `user_id` text NOT NULL REFERENCES `user`(`id`) ON DELETE CASCADE,
  `impersonated_by` text
);

CREATE TABLE IF NOT EXISTS `account` (
  `id` text PRIMARY KEY NOT NULL,
  `account_id` text NOT NULL,
  `provider_id` text NOT NULL,
  `user_id` text NOT NULL REFERENCES `user`(`id`) ON DELETE CASCADE,
  `access_token` text,
  `refresh_token` text,
  `id_token` text,
  `access_token_expires_at` integer,
  `refresh_token_expires_at` integer,
  `scope` text,
  `password` text,
  `created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
  `updated_at` integer NOT NULL
);

CREATE TABLE IF NOT EXISTS `verification` (
  `id` text PRIMARY KEY NOT NULL,
  `identifier` text NOT NULL,
  `value` text NOT NULL,
  `expires_at` integer NOT NULL,
  `created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
  `updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);

CREATE TABLE IF NOT EXISTS `task` (
  `id` text PRIMARY KEY NOT NULL,
  `title` text NOT NULL,
  `priority` integer DEFAULT 1 NOT NULL
);

CREATE TABLE IF NOT EXISTS `document` (
  `id` text PRIMARY KEY NOT NULL,
  `tracking_code` text NOT NULL UNIQUE,
  `submitter_id` text NOT NULL,
  `citizen_email` text,
  `citizen_cccd` text,
  `document_type` text NOT NULL DEFAULT 'CA_NHAN'
    CHECK(`document_type` IN ('CA_NHAN','HO_KINH_DOANH','DOANH_NGHIEP')),
  `status` text NOT NULL DEFAULT 'RECEIVED'
    CHECK(`status` IN (
      'RECEIVED','ASSIGNED','PROCESSING','INVALID',
      'VALIDATED','PENDING_APPROVAL','REVISION_REQUESTED',
      'APPROVED','PUBLISHED','REJECTED'
    )),
  `raw_file_url` text NOT NULL,
  `extracted_data` text,
  `ai_confidence` real,
  `security_level` text NOT NULL DEFAULT 'UNCLASSIFIED',
  `sla_deadline` integer,
  `assigned_dept` text,
  `assigned_by` text,
  `assignment_note` text,
  `created_at` integer NOT NULL DEFAULT (strftime('%s', 'now')),
  `updated_at` integer NOT NULL DEFAULT (strftime('%s', 'now'))
);

CREATE TABLE IF NOT EXISTS `hitl_task` (
  `id` text PRIMARY KEY NOT NULL,
  `document_id` text NOT NULL,
  `task_type` text NOT NULL,
  `assigned_role` text NOT NULL,
  `assigned_user_id` text,
  `status` text NOT NULL DEFAULT 'PENDING',
  `resolution_data` text,
  `created_at` integer NOT NULL DEFAULT (strftime('%s', 'now')),
  `resolved_at` integer
);

CREATE TABLE IF NOT EXISTS `audit_log` (
  `id` text PRIMARY KEY NOT NULL,
  `document_id` text NOT NULL,
  `action` text NOT NULL,
  `actor_id` text NOT NULL,
  `actor_role` text NOT NULL,
  `correlation_id` text NOT NULL,
  `metadata` text,
  `created_at` integer NOT NULL DEFAULT (strftime('%s', 'now'))
);
