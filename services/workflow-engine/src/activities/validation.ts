import { prisma } from '@dvc/database';
import { createLogger, withCorrelation } from '@dvc/logger';

const logger = createLogger({ service: 'workflow-engine' });

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

export async function validateDocument(
  documentId: string,
  extractedData: Record<string, unknown>,
  correlationId: string,
): Promise<ValidationResult> {
  const reqLogger = withCorrelation(logger, correlationId, { documentId });
  const errors: string[] = [];

  const doc = await prisma.document.findUnique({ where: { id: documentId } });
  if (!doc) {
    return { isValid: false, errors: ['Document not found in database'] };
  }

  // Business rule validations
  if (!extractedData['documentType']) {
    errors.push('Missing required field: documentType');
  }

  if (!extractedData['issuingAuthority']) {
    errors.push('Missing required field: issuingAuthority');
  }

  if (extractedData['issueDate']) {
    const issueDate = new Date(extractedData['issueDate'] as string);
    if (isNaN(issueDate.getTime())) {
      errors.push('Invalid issue date format');
    } else if (issueDate > new Date()) {
      errors.push('Issue date cannot be in the future');
    }
  }

  if (extractedData['expiryDate'] && extractedData['issueDate']) {
    const expiry = new Date(extractedData['expiryDate'] as string);
    const issue = new Date(extractedData['issueDate'] as string);
    if (expiry <= issue) {
      errors.push('Expiry date must be after issue date');
    }
  }

  const isValid = errors.length === 0;
  reqLogger.info({ isValid, errorCount: errors.length }, 'Document validation complete');

  if (!isValid) {
    await prisma.document.update({
      where: { id: documentId },
      data: { status: 'REJECTED' },
    });
  }

  return { isValid, errors };
}

export async function assignToDepartment(
  documentId: string,
  department: string,
  correlationId: string,
): Promise<void> {
  const reqLogger = withCorrelation(logger, correlationId, { documentId });

  await prisma.document.update({
    where: { id: documentId },
    data: { assignedDept: department },
  });

  reqLogger.info({ department }, 'Document assigned to department');
}
