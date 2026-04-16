import { Router, Request, Response } from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { prisma } from '@dvc/database';
import { Priority } from '@dvc/shared-types';
import { withCorrelation } from '@dvc/logger';
import type { Logger } from '@dvc/logger';
import { config } from '../config.js';
import { uploadFile } from '../services/storage.js';
import {
  enqueueDocumentProcessing,
  markDocumentApproved,
  markDocumentRejected,
} from '../services/workflow.js';

const SubmitDocumentSchema = z.object({
  priority: z.nativeEnum(Priority).optional().default(Priority.NORMAL),
});

const ApproveSchema = z.object({
  approved: z.boolean(),
  reason: z.string().optional(),
});

export function createDocumentsRouter(logger: Logger): Router {
  const router = Router();

  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: config.maxFileSizeMb * 1024 * 1024 },
    fileFilter(_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) {
      if (config.allowedMimeTypes.includes(file.mimetype as never)) {
        cb(null, true);
      } else {
        cb(new Error(`Unsupported file type: ${file.mimetype}`));
      }
    },
  });

  router.post('/', upload.single('file'), async (req: Request, res: Response) => {
    const correlationId = req.correlationId ?? uuidv4();
    const reqLogger = withCorrelation(logger, correlationId);

    const file = req.file;
    if (!file) {
      res.status(400).json({ error: 'File is required' });
      return;
    }

    const parseResult = SubmitDocumentSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({ error: parseResult.error.flatten() });
      return;
    }

    const { priority } = parseResult.data;
    const submitterId = req.user?.sub ?? 'anonymous';
    const documentId = uuidv4();
    const trackingCode = `DVC-${Date.now()}-${documentId.slice(0, 8).toUpperCase()}`;
    const objectKey = `${documentId}/${file.originalname}`;

    try {
      const { url: rawFileUrl } = await uploadFile(
        config.minio.bucketDocuments,
        objectKey,
        file.buffer,
        file.mimetype,
      );

      await prisma.document.create({
        data: {
          id: documentId,
          trackingCode,
          submitterId,
          priority,
          status: 'RECEIVED',
          rawFileUrl,
        },
      });

      await enqueueDocumentProcessing({
        documentId,
        trackingCode,
        rawFileUrl,
        mimeType: file.mimetype,
        submitterId,
        priority,
        correlationId,
      });

      reqLogger.info({ documentId, trackingCode }, 'Document received and queued in BullMQ');

      res.status(202).json({
        message: 'Document received. Processing has started.',
        documentId,
        trackingCode,
        status: 'RECEIVED',
      });
    } catch (err) {
      reqLogger.error({ err, documentId }, 'Failed to submit document');
      res.status(500).json({ error: 'Internal server error during document submission' });
    }
  });

  router.get('/', async (req: Request, res: Response) => {
    const { status, priority, page = '1' } = req.query;
    const pageSize = 10;
    const skip = (Number(page) - 1) * pageSize;

    const where: Record<string, unknown> = {};
    if (status) where['status'] = status;
    if (priority) where['priority'] = priority;

    const [documents, total] = await Promise.all([
      prisma.document.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      prisma.document.count({ where }),
    ]);

    res.json({ documents, total });
  });

  router.get('/id/:id', async (req: Request, res: Response) => {
    const id = req.params['id'];
    if (typeof id !== 'string') {
      res.status(400).json({ error: 'Invalid ID' });
      return;
    }

    const document = await prisma.document.findUnique({ where: { id } });
    if (!document) {
      res.status(404).json({ error: 'Document not found' });
      return;
    }

    res.json(document);
  });

  router.post('/:documentId/approve', async (req: Request, res: Response) => {
    const documentId = req.params['documentId'];
    if (typeof documentId !== 'string') {
      res.status(400).json({ error: 'Invalid document ID' });
      return;
    }

    const parseResult = ApproveSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({ error: parseResult.error.flatten() });
      return;
    }

    const { approved, reason } = parseResult.data;
    const actor = req.user?.preferred_username ?? req.user?.sub ?? 'system';
    const correlationId = req.correlationId ?? uuidv4();

    try {
      if (approved) {
        await markDocumentApproved(documentId, actor, correlationId);
      } else {
        await markDocumentRejected(documentId, reason ?? 'Rejected by leader', actor, correlationId);
      }
      res.json({ message: approved ? 'Document approved' : 'Document rejected' });
    } catch (err) {
      logger.error({ err, documentId }, 'Failed to approve/reject document');
      res.status(500).json({ error: 'Failed to apply approval decision' });
    }
  });

  router.get('/:trackingCode', async (req: Request, res: Response) => {
    const trackingCode = req.params['trackingCode'];
    if (typeof trackingCode !== 'string') {
      res.status(400).json({ error: 'Invalid tracking code' });
      return;
    }

    const document = await prisma.document.findUnique({
      where: { trackingCode },
      select: {
        id: true,
        trackingCode: true,
        status: true,
        priority: true,
        securityLevel: true,
        aiConfidence: true,
        extractedData: true,
        slaDeadline: true,
        createdAt: true,
        updatedAt: true,
        rawFileUrl: true,
        redactedFileUrl: true,
      },
    });

    if (!document) {
      res.status(404).json({ error: 'Document not found' });
      return;
    }

    res.json(document);
  });

  return router;
}
