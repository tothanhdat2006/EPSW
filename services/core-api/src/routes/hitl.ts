import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { eq, and, inArray, desc } from 'drizzle-orm';
import { documents, hitlTasks } from '../db/schema.js';
import type { Database } from '../db/index.js';
import type { Logger } from '@dvc/logger';
import { markDocumentApproved, markDocumentRejected } from '../services/workflow.js';

const ResolveTaskSchema = z.object({
  resolutionData: z.record(z.unknown()),
});

function canActOnTask(userRoles: string[], requiredRole: string): boolean {
  if (userRoles.includes('ADMIN') || userRoles.includes('LANH_DAO') || userRoles.includes('QUAN_LY')) {
    return true;
  }
  return userRoles.includes(requiredRole);
}

export function createHitlRouter(db: Database, _logger: Logger): Router {
  const router = Router();
  const activeTaskStatuses = ['PENDING', 'IN_PROGRESS'];

  router.get('/tasks', async (req: Request, res: Response) => {
    const userRoles = (req as any).user?.realm_access?.roles ?? [];

    const whereClauses = [inArray(hitlTasks.status, activeTaskStatuses as any)];
    
    if (userRoles.length > 0 && !userRoles.includes('ADMIN')) {
      whereClauses.push(inArray(hitlTasks.assignedRole, userRoles));
    } else if (userRoles.length === 0) {
      // If no roles, return empty
      return res.json({ tasks: [] });
    }

    const tasks = await db.select()
      .from(hitlTasks)
      .where(and(...whereClauses))
      .orderBy(desc(hitlTasks.createdAt));

    // Join with documents manually if needed, or use drizzle-orm relations.
    // To keep it simple, we'll fetch documents for these tasks
    const tasksWithDocs = await Promise.all(tasks.map(async (task) => {
      const doc = await db.select({
        trackingCode: documents.trackingCode,
        priority: documents.priority,
        slaDeadline: documents.slaDeadline,
        createdAt: documents.createdAt,
      })
      .from(documents)
      .where(eq(documents.id, task.documentId))
      .limit(1);
      
      return {
        ...task,
        document: doc[0] || null
      };
    }));

    res.json({ tasks: tasksWithDocs });
  });

  router.post('/tasks/:taskId/claim', async (req: Request, res: Response) => {
    const rawTaskId = req.params['taskId'];
    const taskId = Array.isArray(rawTaskId) ? rawTaskId[0] : rawTaskId;
    const userId = typeof (req as any).user?.sub === 'string' ? (req as any).user.sub : 'unknown';

    if (!taskId) {
      res.status(400).json({ error: 'Invalid task ID' });
      return;
    }

    const taskResult = await db.select().from(hitlTasks).where(eq(hitlTasks.id, taskId)).limit(1);
    const task = taskResult[0];
    
    if (!task) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }

    if (task.status !== 'PENDING') {
      res.status(409).json({ error: 'Task is not available for claiming' });
      return;
    }

    const userRoles = (req as any).user?.realm_access?.roles ?? [];
    if (!canActOnTask(userRoles, task.assignedRole)) {
      res.status(403).json({ error: 'Insufficient role to claim this task' });
      return;
    }

    await db.update(hitlTasks)
      .set({
        assignedUserId: userId,
        status: 'IN_PROGRESS',
      })
      .where(eq(hitlTasks.id, taskId));

    const updated = await db.select().from(hitlTasks).where(eq(hitlTasks.id, taskId)).limit(1);
    res.json(updated[0]);
  });

  router.post('/tasks/:taskId/resolve', async (req: Request, res: Response) => {
    const rawTaskId = req.params['taskId'];
    const taskId = Array.isArray(rawTaskId) ? rawTaskId[0] : rawTaskId;
    const userId = typeof (req as any).user?.sub === 'string' ? (req as any).user.sub : 'unknown';
    const parseResult = ResolveTaskSchema.safeParse(req.body);

    if (!taskId) {
      res.status(400).json({ error: 'Invalid task ID' });
      return;
    }

    if (!parseResult.success) {
      res.status(400).json({ error: parseResult.error.flatten() });
      return;
    }

    const taskResult = await db.select().from(hitlTasks).where(eq(hitlTasks.id, taskId)).limit(1);
    const task = taskResult[0];

    if (!task) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }

    const userRoles = (req as any).user?.realm_access?.roles ?? [];
    if (task.assignedUserId && task.assignedUserId !== userId && !canActOnTask(userRoles, task.assignedRole)) {
      res.status(403).json({ error: 'Not authorized to resolve this task' });
      return;
    }

    const { resolutionData } = parseResult.data;

    await db.update(hitlTasks)
      .set({
        status: 'RESOLVED',
        resolutionData: JSON.stringify(resolutionData),
        resolvedAt: new Date(),
      })
      .where(eq(hitlTasks.id, taskId));

    if (task.taskType === 'AI_REVIEW') {
      const approved = Boolean(resolutionData['approved']);
      if (approved) {
        await db.update(documents)
          .set({ status: 'VALIDATED' })
          .where(eq(documents.id, task.documentId));

        const existsLeaderTask = await db.select()
          .from(hitlTasks)
          .where(
            and(
              eq(hitlTasks.documentId, task.documentId),
              eq(hitlTasks.taskType, 'LEADER_APPROVAL'),
              inArray(hitlTasks.status, ['PENDING', 'IN_PROGRESS'])
            )
          )
          .limit(1);

        if (existsLeaderTask.length === 0) {
          await db.insert(hitlTasks).values({
            id: crypto.randomUUID(),
            documentId: task.documentId,
            taskType: 'LEADER_APPROVAL',
            assignedRole: 'LANH_DAO',
            status: 'PENDING',
          });
        }
      } else {
        await db.update(documents)
          .set({ status: 'REJECTED' })
          .where(eq(documents.id, task.documentId));
      }
    }

    if (task.taskType === 'LEADER_APPROVAL') {
      const approved = Boolean(resolutionData['approved']);
      const reason = String(resolutionData['reason'] ?? 'Rejected by leader');

      if (approved) {
        await markDocumentApproved(db, task.documentId, userId, (req as any).correlationId ?? crypto.randomUUID());
      } else {
        await markDocumentRejected(db, task.documentId, reason, userId, (req as any).correlationId ?? crypto.randomUUID());
      }
    }

    if (task.taskType === 'MANAGER_ESCALATION') {
      await db.update(documents)
        .set({ status: 'VALIDATED' })
        .where(eq(documents.id, task.documentId));
    }

    res.json({ message: 'Task resolved successfully', taskId });
  });

  router.get('/tasks/:taskId', async (req: Request, res: Response) => {
    const rawTaskId = req.params['taskId'];
    const taskId = Array.isArray(rawTaskId) ? rawTaskId[0] : rawTaskId;

    if (!taskId) {
      res.status(400).json({ error: 'Invalid task ID' });
      return;
    }

    const taskResult = await db.select().from(hitlTasks).where(eq(hitlTasks.id, taskId)).limit(1);
    const task = taskResult[0];

    if (!task) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }

    const docResult = await db.select().from(documents).where(eq(documents.id, task.documentId)).limit(1);
    
    res.json({
      ...task,
      document: docResult[0] || null
    });
  });

  return router;
}
