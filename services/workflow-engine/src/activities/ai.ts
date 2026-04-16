import { prisma } from '@dvc/database';
import { createLogger } from '@dvc/logger';

const logger = createLogger({ service: 'workflow-engine' });

// We assume the AI Agent Service runs on its configured port locally.
const AI_AGENT_URL = process.env['AI_AGENT_URL'] || 'http://localhost:8002';

export async function generateExecutiveSummary(
  documentId: string,
  text: string,
  correlationId: string,
): Promise<string[]> {
  logger.info({ documentId, correlationId }, 'Generating executive summary via AI Agent');

  const res = await fetch(`${AI_AGENT_URL}/api/summarize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });

  if (!res.ok) {
    throw new Error(`AI Agent responded with status ${res.status}`);
  }

  const result = (await res.json()) as { summary_bullets?: string[] };
  const summaryBullets = result.summary_bullets ?? [];

  // Update DB with the summary
  const doc = await prisma.document.findUnique({ where: { id: documentId } });
  if (doc) {
    const extractedData = (doc.extractedData as Record<string, unknown>) || {};
    extractedData['executiveSummary'] = summaryBullets;
    await prisma.document.update({
      where: { id: documentId },
      data: { extractedData: { ...extractedData } as any },
    });
  }

  return summaryBullets;
}

export async function routeRejection(
  documentId: string,
  reason: string,
  currentDept: string,
  correlationId: string,
): Promise<{ routed_department: string; analysis: string }> {
  logger.info({ documentId, correlationId }, 'Analyzing rejection routing via AI Agent');

  const res = await fetch(`${AI_AGENT_URL}/api/route-rejection`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason, current_dept: currentDept }),
  });

  if (!res.ok) {
    throw new Error(`AI Agent responded with status ${res.status}`);
  }

  const result = (await res.json()) as { routed_department?: string; analysis?: string };

  // Update DB with the rejection routing (optional, or left to workflow)
  return {
    routed_department: result.routed_department ?? 'REJECT_ALL',
    analysis: result.analysis ?? 'Auto-failed due to AI error',
  };
}
