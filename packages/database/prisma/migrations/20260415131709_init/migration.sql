-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('NORMAL', 'URGENT', 'FLASH');

-- CreateEnum
CREATE TYPE "DocStatus" AS ENUM ('RECEIVED', 'PROCESSING', 'HITL_REVIEW', 'VALIDATED', 'REJECTED', 'APPROVED', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "SecurityLevel" AS ENUM ('UNCLASSIFIED', 'RESTRICTED', 'CONFIDENTIAL', 'SECRET');

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "trackingCode" TEXT NOT NULL,
    "submitterId" TEXT NOT NULL,
    "priority" "Priority" NOT NULL DEFAULT 'NORMAL',
    "status" "DocStatus" NOT NULL DEFAULT 'RECEIVED',
    "rawFileUrl" TEXT NOT NULL,
    "redactedFileUrl" TEXT,
    "extractedData" JSONB,
    "aiConfidence" DOUBLE PRECISION,
    "securityLevel" "SecurityLevel" NOT NULL DEFAULT 'UNCLASSIFIED',
    "slaDeadline" TIMESTAMP(3),
    "assignedDept" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HitlTask" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "taskType" TEXT NOT NULL,
    "assignedRole" TEXT NOT NULL,
    "assignedUserId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "resolutionData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "HitlTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "actorRole" TEXT NOT NULL,
    "correlationId" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Document_trackingCode_key" ON "Document"("trackingCode");

-- CreateIndex
CREATE INDEX "Document_status_idx" ON "Document"("status");

-- CreateIndex
CREATE INDEX "Document_submitterId_idx" ON "Document"("submitterId");

-- CreateIndex
CREATE INDEX "Document_trackingCode_idx" ON "Document"("trackingCode");

-- CreateIndex
CREATE INDEX "HitlTask_documentId_idx" ON "HitlTask"("documentId");

-- CreateIndex
CREATE INDEX "HitlTask_assignedRole_status_idx" ON "HitlTask"("assignedRole", "status");

-- CreateIndex
CREATE INDEX "AuditLog_documentId_idx" ON "AuditLog"("documentId");

-- CreateIndex
CREATE INDEX "AuditLog_correlationId_idx" ON "AuditLog"("correlationId");

-- AddForeignKey
ALTER TABLE "HitlTask" ADD CONSTRAINT "HitlTask_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
