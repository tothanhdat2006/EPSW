import { Router, Request, Response } from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { eq, and, desc, sql } from 'drizzle-orm';
import { documents } from '../db/schema.js';
import type { Database } from '../db/index.js';
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
  priority: z.enum(['NORMAL', 'URGENT', 'FLASH']).optional().default('NORMAL'),
  email: z.string().email().optional(),
});

const ApproveSchema = z.object({
  approved: z.boolean(),
  reason: z.string().optional(),
});

export function createDocumentsRouter(db: Database, logger: Logger): Router {
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
    const correlationId = (req as any).correlationId ?? uuidv4();
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

    const { priority, email } = parseResult.data;
    const submitterId = (req as any).user?.sub ?? 'anonymous';
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

      await db.insert(documents).values({
        id: documentId,
        trackingCode,
        submitterId,
        citizenEmail: email || null,
        priority: priority as any,
        status: 'RECEIVED',
        rawFileUrl,
      });

      await enqueueDocumentProcessing({
        documentId,
        trackingCode,
        rawFileUrl,
        mimeType: file.mimetype,
        submitterId,
        priority: priority as any,
        correlationId,
      });

      reqLogger.info({ documentId, trackingCode, email }, 'Document received and queued in BullMQ');

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
    const offset = (Number(page) - 1) * pageSize;

    const conditions: any[] = [];
    if (status) conditions.push(eq(documents.status, status as any) as any);
    if (priority) conditions.push(eq(documents.priority, priority as any) as any);
    
    const whereClause = conditions.length > 0 ? (and(...conditions) as any) : undefined;

    const [docs, totalResult] = await Promise.all([
      (db as any).select()
        .from(documents as any)
        .where(whereClause)
        .orderBy(desc(documents.createdAt) as any)
        .limit(pageSize)
        .offset(offset),
      (db as any).select({ count: sql`count(*)` })
        .from(documents as any)
        .where(whereClause),
    ]);

    res.json({ documents: docs, total: Number((totalResult[0] as any)?.count ?? 0) });
  });

  router.get('/id/:id', async (req: Request, res: Response) => {
    const id = req.params['id'];
    if (typeof id !== 'string') {
      res.status(400).json({ error: 'Invalid ID' });
      return;
    }

    const docResult = await (db as any).select().from(documents as any).where(eq(documents.id, id) as any).limit(1);
    const document = docResult[0];
    
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
    const actor = (req as any).user?.preferred_username ?? (req as any).user?.sub ?? 'system';
    const correlationId = (req as any).correlationId ?? uuidv4();

    try {
      if (approved) {
        await markDocumentApproved(db, documentId, actor, correlationId);
      } else {
        await markDocumentRejected(db, documentId, reason ?? 'Rejected by leader', actor, correlationId);
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

    const docs = await db.select()
      .from(documents)
      .where(eq(documents.trackingCode, trackingCode))
      .limit(1);
    
    const document = docs[0];

    if (!document) {
      res.status(404).json({ error: 'Document not found' });
      return;
    }

    res.json(document);
  });

  return router;
}
