# System Architecture Context: DVC Workflow System

## System Objective
A high-throughput, secure, AI-augmented document processing system for public/enterprise services. It balances heavy automation (LLMs, OCR) with strict Human-In-The-Loop (HITL) checkpoints.

## Microservices Breakdown

### 1. Ingestion Service (Node.js/TypeScript)
- **Responsibility:** Receive payloads from Web Portal, Offline Scanners, and Batch Jobs.
- **Action:** Validate basic payload, upload raw files to MinIO/S3, and publish event `document.received` to Kafka.

### 2. Document Parser Service (Python)
- **Responsibility:** Consume `document.received`.
- **Action:** Split files. Use PDF Reader for native PDFs, Tesseract/DocAI for Scans. Extract raw text.
- **HITL Route:** If text is unreadable, emit `hitl.manual_entry_required`.

### 3. AI Agent Service (Python - FastAPI & LangChain)
- **Responsibility:** Consume parsed text.
- **Action:** - Classify document type and urgency.
  - Identify PII/Confidential data and Redact it.
  - Extract structured JSON data.
- **Rule:** Calculate Confidence Score. If > 70, save to DB. If < 70, emit `hitl.review_required`.

### 4. Workflow & SLA Engine (Temporal.io - TypeScript worker)
- **Responsibility:** Manage the state machine of the document.
- **Action:** Run dynamic SLA timers (e.g., 2 hours for Urgent, 48 hours for Normal). If SLA breaches, trigger escalation event to Managers. Run validation logic against PostgreSQL schema.

### 5. Approval & Notification Service (Node.js)
- **Responsibility:** Handle final routing.
- **Action:** Generate summary via LLM for leaders. Translate rejection reasons for secretaries. Dispatch final Zalo/SMS/Email notifications.


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