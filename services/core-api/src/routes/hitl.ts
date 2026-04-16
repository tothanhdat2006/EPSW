import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '@dvc/database';
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

export function createHitlRouter(_logger: Logger): Router {
  const router = Router();
  const activeTaskStatuses = ['PENDING', 'IN_PROGRESS'];

  router.get('/tasks', async (req: Request, res: Response) => {
    const userRoles = req.user?.realm_access?.roles ?? [];

    const where =
      userRoles.length > 0 && !userRoles.includes('ADMIN')
        ? {
            status: { in: activeTaskStatuses },
            assignedRole: { in: userRoles },
          }
        : {
            status: { in: activeTaskStatuses },
          };

    const tasks = await prisma.hitlTask.findMany({
      where,
      include: {
        document: {
          select: {
            trackingCode: true,
            priority: true,
            slaDeadline: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    res.json({ tasks });
  });

  router.post('/tasks/:taskId/claim', async (req: Request, res: Response) => {
    const rawTaskId = req.params['taskId'];
    const taskId = Array.isArray(rawTaskId) ? rawTaskId[0] : rawTaskId;
    const userId = typeof req.user?.sub === 'string' ? req.user.sub : 'unknown';

    if (!taskId) {
      res.status(400).json({ error: 'Invalid task ID' });
      return;
    }

    const task = await prisma.hitlTask.findUnique({ where: { id: taskId } });
    if (!task) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }

    if (task.status !== 'PENDING') {
      res.status(409).json({ error: 'Task is not available for claiming' });
      return;
    }

    const userRoles = req.user?.realm_access?.roles ?? [];
    if (!canActOnTask(userRoles, task.assignedRole)) {
      res.status(403).json({ error: 'Insufficient role to claim this task' });
      return;
    }

    const updated = await prisma.hitlTask.update({
      where: { id: taskId },
      data: {
        assignedUserId: userId,
        status: 'IN_PROGRESS',
      },
    });

    res.json(updated);
  });

  router.post('/tasks/:taskId/resolve', async (req: Request, res: Response) => {
    const rawTaskId = req.params['taskId'];
    const taskId = Array.isArray(rawTaskId) ? rawTaskId[0] : rawTaskId;
    const userId = typeof req.user?.sub === 'string' ? req.user.sub : 'unknown';
    const parseResult = ResolveTaskSchema.safeParse(req.body);

    if (!taskId) {
      res.status(400).json({ error: 'Invalid task ID' });
      return;
    }

    if (!parseResult.success) {
      res.status(400).json({ error: parseResult.error.flatten() });
      return;
    }

    const task = await prisma.hitlTask.findUnique({
      where: { id: taskId },
      include: { document: true },
    });

    if (!task) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }

    const userRoles = req.user?.realm_access?.roles ?? [];
    if (task.assignedUserId && task.assignedUserId !== userId && !canActOnTask(userRoles, task.assignedRole)) {
      res.status(403).json({ error: 'Not authorized to resolve this task' });
      return;
    }

    const { resolutionData } = parseResult.data;

    await prisma.hitlTask.update({
      where: { id: taskId },
      data: {
        status: 'RESOLVED',
        resolutionData: resolutionData as any,
        resolvedAt: new Date(),
      },
    });

    if (task.taskType === 'AI_REVIEW') {
      const approved = Boolean(resolutionData['approved']);
      if (approved) {
        await prisma.document.update({
          where: { id: task.documentId },
          data: { status: 'VALIDATED' },
        });

        const existsLeaderTask = await prisma.hitlTask.findFirst({
          where: {
            documentId: task.documentId,
            taskType: 'LEADER_APPROVAL',
            status: { in: ['PENDING', 'IN_PROGRESS'] },
          },
        });

        if (!existsLeaderTask) {
          await prisma.hitlTask.create({
            data: {
              documentId: task.documentId,
              taskType: 'LEADER_APPROVAL',
              assignedRole: 'LANH_DAO',
              status: 'PENDING',
            },
          });
        }
      } else {
        await prisma.document.update({
          where: { id: task.documentId },
          data: { status: 'REJECTED' },
        });
      }
    }

    if (task.taskType === 'LEADER_APPROVAL') {
      const approved = Boolean(resolutionData['approved']);
      const reason = String(resolutionData['reason'] ?? 'Rejected by leader');

      if (approved) {
        await markDocumentApproved(task.documentId, userId, req.correlationId ?? globalThis.crypto.randomUUID());
      } else {
        await markDocumentRejected(task.documentId, reason, userId, req.correlationId ?? globalThis.crypto.randomUUID());
      }
    }

    if (task.taskType === 'MANAGER_ESCALATION') {
      await prisma.document.update({
        where: { id: task.documentId },
        data: { status: 'VALIDATED' },
      });
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

    const task = await prisma.hitlTask.findUnique({
      where: { id: taskId },
      include: { document: true },
    });

    if (!task) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }

    res.json(task);
  });

  return router;
}
