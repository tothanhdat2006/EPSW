import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { documents } from '../db/schema.js';
import type { Database } from '../db/index.js';
import type { Logger } from '@dvc/logger';
import { chatWithDocumentContext } from '../services/ai.js';
import { enqueueDocumentProcessing } from '../services/workflow.js';

const ChatSchema = z.object({
  documentId: z.string().uuid(),
  message: z.string().min(1),
  history: z.array(z.object({ role: z.string(), content: z.string() })).default([]),
});

const ReAnalyzeSchema = z.object({
  documentId: z.string().uuid(),
  trackingCode: z.string().optional(),
  rawText: z.string().optional(),
});

export function createAiRouter(db: Database, logger: Logger): Router {
  const router = Router();

  router.post('/chat', async (req: Request, res: Response) => {
    const parseResult = ChatSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({ error: parseResult.error.flatten() });
      return;
    }

    const { documentId, message, history } = parseResult.data;

    try {
      const docResult = await db.select().from(documents).where(eq(documents.id, documentId)).limit(1);
      const doc = docResult[0];
      
      if (!doc) {
        res.status(404).json({ error: 'Document not found' });
        return;
      }

      const context = (doc.extractedData ? JSON.parse(doc.extractedData) : {}) as Record<string, unknown>;
      const response = await chatWithDocumentContext(message, history, context);
      res.json({ response });
    } catch (err) {
      logger.error({ err, documentId }, 'AI chat failed');
      res.status(500).json({ error: 'AI chat failed' });
    }
  });

  router.post('/re-analyze', async (req: Request, res: Response) => {
    const parseResult = ReAnalyzeSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({ error: parseResult.error.flatten() });
      return;
    }

    const { documentId } = parseResult.data;

    const docResult = await db.select().from(documents).where(eq(documents.id, documentId)).limit(1);
    const doc = docResult[0];
    
    if (!doc) {
      res.status(404).json({ error: 'Document not found' });
      return;
    }

    await enqueueDocumentProcessing({
      documentId: doc.id,
      trackingCode: doc.trackingCode,
      rawFileUrl: doc.rawFileUrl,
      mimeType: doc.rawFileUrl.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg',
      submitterId: doc.submitterId,
      priority: doc.priority as any,
      correlationId: (req as any).correlationId ?? crypto.randomUUID(),
    });

    res.json({ status: 'success', message: 'Re-analysis queued' });
  });

  return router;
}
