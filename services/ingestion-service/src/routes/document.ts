import { Router, Request, Response } from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { prisma } from '@dvc/database';
import { KAFKA_TOPICS, Priority, type DocumentReceivedEvent } from '@dvc/shared-types';
import { withCorrelation } from '@dvc/logger';
import { uploadFile } from '../services/storage.js';
import { publishEvent } from '../services/kafka.js';
import { config } from '../config.js';
import type { Logger } from '@dvc/logger';

const SubmitDocumentSchema = z.object({
  priority: z.nativeEnum(Priority).optional().default(Priority.NORMAL),
});

export function createDocumentRouter(logger: Logger): Router {
  const router = Router();

  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: config.maxFileSizeMb * 1024 * 1024 },
    fileFilter(_req, file, cb) {
      if (config.allowedMimeTypes.includes(file.mimetype as never)) {
        cb(null, true);
      } else {
        cb(new Error(`Unsupported file type: ${file.mimetype}`));
      }
    },
  });

  // POST /api/documents — Receive a new document submission
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

    reqLogger.info({ documentId, trackingCode, priority, fileSize: file.size }, 'Ingesting document');

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

      const event: DocumentReceivedEvent = {
        eventId: uuidv4(),
        correlationId,
        timestamp: new Date().toISOString(),
        version: '1.0',
        type: 'document.received',
        payload: {
          documentId,
          trackingCode,
          submitterId,
          priority,
          rawFileUrl,
          fileName: file.originalname,
          mimeType: file.mimetype,
          fileSizeBytes: file.size,
        },
      };

      await publishEvent(KAFKA_TOPICS.DOCUMENT_RECEIVED, event);

      reqLogger.info({ documentId, trackingCode }, 'Document ingested and event published');

      res.status(202).json({
        message: 'Document received. Processing has started.',
        documentId,
        trackingCode,
        status: 'RECEIVED',
      });
    } catch (err) {
      reqLogger.error({ err, documentId }, 'Failed to ingest document');
      res.status(500).json({ error: 'Internal server error during ingestion' });
    }
  });

  // GET /api/documents — List documents with filtering
  router.get('/', async (req: Request, res: Response) => {
    const { status, priority, page = '1' } = req.query;
    const pageSize = 10;
    const skip = (Number(page) - 1) * pageSize;

    const where: any = {};
    if (status) where.status = status;
    if (priority) where.priority = priority;

    try {
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
    } catch (err) {
      logger.error({ err }, 'Failed to list documents');
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // GET /api/documents/id/:id — Get full document by ID (Internal use)
  router.get('/id/:id', async (req: Request, res: Response) => {
    const id = req.params['id'];
    if (typeof id !== 'string') {
      res.status(400).json({ error: 'Invalid ID' });
      return;
    }
    const document = await prisma.document.findUnique({
      where: { id },
    });

    if (!document) {
      res.status(404).json({ error: 'Document not found' });
      return;
    }

    res.json(document);
  });

  // GET /api/documents/:trackingCode — Track document status (Public use)
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
