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
import type * as aiActivities from '../activities/ai.js';
import type * as pdfActivities from '../activities/pdf.js';

const { setSlaDeadline, emitEscalationEvent, emitLeaderApprovalEvent } = proxyActivities<typeof slaActivities>({
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

const { generateExecutiveSummary, routeRejection } = proxyActivities<typeof aiActivities>({
  startToCloseTimeout: '2 minutes', // AI queries take time
  retry: { maximumAttempts: 3 },
});

const { generateFinalPdf } = proxyActivities<typeof pdfActivities>({
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

  setHandler(hitlResolvedSignal, (data) => {
    hitlResolved = true;
    if (data.resolutionData && typeof data.resolutionData.approved === 'boolean') {
      approvalResult = {
        approved: data.resolutionData.approved as boolean,
        reason: data.resolutionData.reason as string | undefined,
        approvedBy: (data.resolutionData.resolvedBy as string) ?? 'Leader',
      };
    }
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

  // Fetch the text/content of the document (assuming `extractedData.rawText` has it, or we rely on the activity fetching it from DB)
  // For safety and size limits, AI activity pulls data from DB or we pass the available text.
  let docText = 'Document content unavailable';
  if (extractedData['rawText']) {
    docText = String(extractedData['rawText']);
  }

  // Step 4.5: Generate Executive Summary for Leader
  log.info('Generating executive summary', { documentId });
  await generateExecutiveSummary(documentId, docText, correlationId);

  // Emit the HITL task for Leader
  await emitLeaderApprovalEvent(documentId, trackingCode, correlationId);
  currentStatus = 'HITL_REVIEW'; // Leader review is technically a HITL step

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

  // Wait for hitl resolution from Leader (the UI should trigger /resolve endpoint)
  // When Leader resolves it, `hitlResolved` becomes true and we extract the decision
  const waitForApprovalFromHitl = async () => {
    await condition(() => hitlResolved === true, '30 days');
    // Once hitl is resolved, we expect approvalResult to be populated either through a dedicated signal,
    // or by inspecting the DB manually in real life. Here, we assume the API sends both `hitlResolvedSignal` AND `approvalSignal`.
  };

  const waitForDirectApproval = async () => {
    await condition(() => approvalResult !== null, '30 days');
  };

  await Promise.race([waitForApprovalFromHitl(), waitForDirectApproval()]);
  // Give it a tiny bit to process signals
  await sleep(100);

  // Step 6: Route based on approval decision
  // If we only got hitl resolution but no explicit approvalResult, we default to reject
  const result = approvalResult as { approved: boolean; reason?: string; approvedBy: string } | null;
  if (!result || !result.approved) {
    currentStatus = 'REJECTED';
    const rejectReason = result?.reason ?? 'Lãnh đạo từ chối hồ sơ không nêu lí do';
    log.info('Document rejected by leader', { documentId, reason: rejectReason });

    // AI Rejection Routing
    const routingResult = await routeRejection(documentId, rejectReason, department, correlationId);

    await publishNotification(
      submitterId,
      `Hồ sơ ${trackingCode} bị từ chối`,
      `${rejectReason}\n(Hồ sơ đã được chuyển trả về bộ phận: ${routingResult.routed_department})`,
      correlationId,
      documentId,
      trackingCode,
    );
    return;
  }

  // Step 7: Approve and publish (Phase 6 Final loop)
  currentStatus = 'APPROVED';
  log.info('Document approved, generating final PDF', { documentId, approvedBy: result!.approvedBy });

  const publishedFileUrl = await generateFinalPdf(documentId, correlationId);

  await publishNotification(
    submitterId,
    `Hồ sơ ${trackingCode} đã được phê duyệt`,
    `Hồ sơ của bạn đã được phê duyệt bởi ${result!.approvedBy}. Bạn có thể xem kết quả trực tuyến.\nURL bản điện tử: ${publishedFileUrl}`,
    correlationId,
    documentId,
    trackingCode,
  );

  currentStatus = 'PUBLISHED';
  log.info('Document workflow completed', { documentId });
}
