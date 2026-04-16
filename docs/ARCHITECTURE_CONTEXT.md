# System Architecture Context: DVC Workflow System

## System Objective
A high-throughput, secure, AI-augmented document processing system for public/enterprise services. It balances heavy automation (LLMs, OCR) with strict Human-In-The-Loop (HITL) checkpoints.

## Unified Runtime Breakdown

### 1. Ingestion Layer (`core-api`)
- **Responsibility:** Receive uploads from web channels and APIs.
- **Action:** Validate metadata, upload raw files to MinIO, persist initial document row in PostgreSQL.

### 2. Queue Layer (BullMQ + Redis)
- **Responsibility:** Orchestrate asynchronous work reliably.
- **Action:** Enqueue processing jobs, schedule SLA checks, and run notification jobs with retries/backoff.

### 3. Parsing + AI Layer (`core-api` services)
- **Responsibility:** Parse OCR/text content and run AI extraction/classification.
- **Action:** Extract raw text, classify urgency/security, produce structured data, and compute confidence.
- **HITL Rule:** Confidence below threshold routes to HITL tasks.

### 4. Workflow + SLA Layer (`core-api`)
- **Responsibility:** Drive status transitions and escalation rules.
- **Action:** Move documents across RECEIVED -> PROCESSING -> VALIDATED/HITL -> APPROVED/REJECTED/PUBLISHED and trigger manager escalation on SLA breach.

### 5. Approval + Notification Layer (`core-api`)
- **Responsibility:** Complete approval lifecycle and outbound comms.
- **Action:** Handle leader approval/rejection, create secretary follow-up tasks when needed, and send email/SMS/Zalo notifications.


## Schema
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum Priority {
  NORMAL
  URGENT
  FLASH   // Hỏa tốc
}

enum DocStatus {
  RECEIVED
  PROCESSING
  HITL_REVIEW
  VALIDATED
  REJECTED
  APPROVED
  PUBLISHED
}

model Document {
  id              String      @id @default(uuid())
  trackingCode    String      @unique
  submitterId     String      // Link to User/Org
  priority        Priority    @default(NORMAL)
  status          DocStatus   @default(RECEIVED)
  
  rawFileUrl      String      // S3 path
  redactedFileUrl String?     // S3 path after AI redaction
  
  extractedData   Json?       // Data extracted by AI/LangChain
  aiConfidence    Float?      // 0.0 to 100.0
  
  slaDeadline     DateTime?
  
  createdAt       DateTime    @default(now())
  updatedAt       DateTime    @updatedAt

  hitlTasks       HitlTask[]
}

model HitlTask {
  id              String      @id @default(uuid())
  documentId      String
  document        Document    @relation(fields: [documentId], references: [id])
  
  taskType        String      // "OCR_FIX", "AI_REVIEW", "MANAGER_ESCALATION", "PRINT_ISSUE"
  assignedRole    String      // RBAC matching Keycloak (e.g., "VAN_THU", "CHUYEN_VIEN")
  assignedUserId  String?     // Can be null until claimed
  
  status          String      // "PENDING", "IN_PROGRESS", "RESOLVED"
  resolutionData  Json?       // What the human actually corrected
  
  createdAt       DateTime    @default(now())
  resolvedAt      DateTime?
}