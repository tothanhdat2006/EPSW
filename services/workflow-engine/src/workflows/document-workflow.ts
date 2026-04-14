import {
  proxyActivities,
  sleep,
  defineSignal,
  defineQuery,
  setHandler,
  condition,
  log,
} from '@temporalio/workflow';
import type * as slaActivities from '../activities/sla.js';
import type * as validationActivities from '../activities/validation.js';
import type * as notificationActivities from '../activities/notification.js';

const { setSlaDeadline, emitEscalationEvent } = proxyActivities<typeof slaActivities>({
  startToCloseTimeout: '30 seconds',
  retry: { maximumAttempts: 3 },
});

const { validateDocument, assignToDepartment } = proxyActivities<typeof validationActivities>({
  startToCloseTimeout: '30 seconds',
  retry: { maximumAttempts: 3 },
});

const { publishNotification, publishValidatedEvent } =
  proxyActivities<typeof notificationActivities>({
    startToCloseTimeout: '30 seconds',
    retry: { maximumAttempts: 3 },
  });

// ── Signals (external events that resume the workflow) ────────────────────────
export const approvalSignal = defineSignal<[{ approved: boolean; reason?: string; approvedBy: string }]>('approval');
export const hitlResolvedSignal = defineSignal<[{ resolutionData: Record<string, unknown> }]>('hitlResolved');

// ── Queries (read current state without modifying it) ─────────────────────────
export const getStatusQuery = defineQuery<string>('getStatus');
export const getSlaDeadlineQuery = defineQuery<string | null>('getSlaDeadline');

export interface DocumentWorkflowInput {
  documentId: string;
  trackingCode: string;
  submitterId: string;
  priority: string;
  extractedData: Record<string, unknown>;
  correlationId: string;
}

export async function documentWorkflow(input: DocumentWorkflowInput): Promise<void> {
  const { documentId, trackingCode, submitterId, priority, extractedData, correlationId } = input;

  let currentStatus = 'PROCESSING';
  let slaDeadline: string | null = null;
  let approvalResult: { approved: boolean; reason?: string; approvedBy: string } | null = null;
  let hitlResolved = false;

  setHandler(getStatusQuery, () => currentStatus);
  setHandler(getSlaDeadlineQuery, () => slaDeadline);

  setHandler(approvalSignal, (result) => {
    approvalResult = result;
  });

  setHandler(hitlResolvedSignal, (_data) => {
    hitlResolved = true;
  });

  log.info('Document workflow started', { documentId, priority });

  // Step 1: Validate document
  const validation = await validateDocument(documentId, extractedData, correlationId);
  if (!validation.isValid) {
    log.warn('Document validation failed', { documentId, errors: validation.errors });
    currentStatus = 'REJECTED';

    await publishNotification(
      submitterId,
      `Hồ sơ ${trackingCode} không hợp lệ`,
      `Hồ sơ của bạn không được chấp nhận vì: ${validation.errors.join(', ')}`,
      correlationId,
      documentId,
      trackingCode,
    );
    return;
  }

  // Step 2: Assign to department
  const department = (extractedData['department'] as string) ?? 'DEFAULT_DEPT';
  await assignToDepartment(documentId, department, correlationId);
  currentStatus = 'VALIDATED';

  // Step 3: Set SLA deadline
  slaDeadline = await setSlaDeadline(documentId, priority, correlationId);

  // Notify submitter of assignment
  await publishValidatedEvent(
    documentId,
    trackingCode,
    submitterId,
    department,
    slaDeadline,
    correlationId,
  );

  log.info('Document validated and assigned', { documentId, department, slaDeadline });

  // Step 4: Wait for HITL if needed (may already be resolved)
  if (extractedData['requiresHitl']) {
    log.info('Waiting for HITL resolution', { documentId });
    currentStatus = 'HITL_REVIEW';
    await condition(() => hitlResolved, '7 days');
    currentStatus = 'VALIDATED';
  }

  // Step 5: SLA monitoring + wait for approval
  const slaMs =
    priority === 'FLASH'
      ? 30 * 60 * 1000
      : priority === 'URGENT'
        ? 2 * 60 * 60 * 1000
        : 48 * 60 * 60 * 1000;

  // Race between SLA timeout and approval signal
  let slaBreached = false;

  const slaMonitor = async () => {
    await sleep(slaMs);
    if (!approvalResult) {
      slaBreached = true;
      const overdueByMinutes = 0;
      await emitEscalationEvent(documentId, trackingCode, slaDeadline!, overdueByMinutes, correlationId);
      log.warn('SLA breached — escalation emitted', { documentId, priority });
    }
  };

  // Wait for approval signal (up to 30 days max)
  const waitForApproval = async () => {
    await condition(() => approvalResult !== null, '30 days');
  };

  await Promise.all([slaMonitor(), waitForApproval()]);

  // Step 6: Route based on approval decision
  if (!approvalResult || !approvalResult.approved) {
    currentStatus = 'REJECTED';
    log.info('Document rejected by leader', { documentId, reason: approvalResult?.reason });

    await publishNotification(
      submitterId,
      `Hồ sơ ${trackingCode} bị từ chối`,
      approvalResult?.reason ?? 'Lãnh đạo từ chối hồ sơ',
      correlationId,
      documentId,
      trackingCode,
    );
    return;
  }

  // Step 7: Approve and publish
  currentStatus = 'APPROVED';
  log.info('Document approved', { documentId, approvedBy: approvalResult.approvedBy });

  await publishNotification(
    submitterId,
    `Hồ sơ ${trackingCode} đã được phê duyệt`,
    `Hồ sơ của bạn đã được phê duyệt bởi ${approvalResult.approvedBy}. Vui lòng kiểm tra kết quả trên cổng DVC.`,
    correlationId,
    documentId,
    trackingCode,
  );

  currentStatus = 'PUBLISHED';
  log.info('Document workflow completed', { documentId });
}
