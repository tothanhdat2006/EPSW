import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '@dvc/database';
import { KAFKA_TOPICS, HitlTaskStatus } from '@dvc/shared-types';
import { withCorrelation } from '@dvc/logger';
import { Kafka, Partitioners } from 'kafkajs';
import { v4 as uuidv4 } from 'uuid';
import { canActOnTask } from '../services/keycloak.js';
import { config } from '../config.js';
import type { Logger } from '@dvc/logger';

const ResolveTaskSchema = z.object({
  resolutionData: z.record(z.unknown()),
});

export function createTasksRouter(logger: Logger): Router {
  const router = Router();
  const kafka = new Kafka({ clientId: config.kafka.clientId, brokers: config.kafka.brokers });

  // GET /api/hitl/tasks — List pending HITL tasks (filtered by caller's role)
  router.get('/', async (req: Request, res: Response) => {
    const userRoles = req.user?.realm_access?.roles ?? [];
    const correlationId = req.correlationId ?? uuidv4();
    const reqLogger = withCorrelation(logger, correlationId);

    const tasks = await prisma.hitlTask.findMany({
      where: {
        status: { in: [HitlTaskStatus.PENDING, HitlTaskStatus.IN_PROGRESS] },
        assignedRole: { in: userRoles },
      },
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

    reqLogger.info({ count: tasks.length }, 'HITL tasks listed');
    res.json({ tasks });
  });

  // POST /api/hitl/tasks/:taskId/claim — Claim a task
  router.post('/:taskId/claim', async (req: Request, res: Response) => {
    const { taskId } = req.params;
    const userId = req.user?.sub ?? '';
    const correlationId = req.correlationId ?? uuidv4();
    const reqLogger = withCorrelation(logger, correlationId, { taskId });

    const task = await prisma.hitlTask.findUnique({ where: { id: taskId } });
    if (!task) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }

    if (task.status !== HitlTaskStatus.PENDING) {
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
      data: { assignedUserId: userId, status: HitlTaskStatus.IN_PROGRESS },
    });

    reqLogger.info({ userId, taskId }, 'HITL task claimed');
    res.json(updated);
  });

  // POST /api/hitl/tasks/:taskId/resolve — Resolve a task
  router.post('/:taskId/resolve', async (req: Request, res: Response) => {
    const { taskId } = req.params;
    const userId = req.user?.sub ?? '';
    const correlationId = req.correlationId ?? uuidv4();
    const reqLogger = withCorrelation(logger, correlationId, { taskId });

    const parseResult = ResolveTaskSchema.safeParse(req.body);
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

    if (task.assignedUserId !== userId) {
      const userRoles = req.user?.realm_access?.roles ?? [];
      if (!canActOnTask(userRoles, task.assignedRole)) {
        res.status(403).json({ error: 'Not authorized to resolve this task' });
        return;
      }
    }

    const { resolutionData } = parseResult.data;

    await prisma.hitlTask.update({
      where: { id: taskId },
      data: {
        status: HitlTaskStatus.RESOLVED,
        resolutionData,
        resolvedAt: new Date(),
      },
    });

    // Emit hitl.resolved so the workflow engine can resume
    const producer = kafka.producer({ createPartitioner: Partitioners.DefaultPartitioner });
    await producer.connect();

    const event = {
      eventId: uuidv4(),
      correlationId,
      timestamp: new Date().toISOString(),
      version: '1.0',
      type: 'hitl.resolved',
      payload: {
        documentId: task.documentId,
        hitlTaskId: taskId,
        resolvedBy: userId,
        resolutionData,
      },
    };

    await producer.send({
      topic: KAFKA_TOPICS.HITL_RESOLVED,
      messages: [{ key: task.documentId, value: JSON.stringify(event) }],
    });

    await producer.disconnect();
    reqLogger.info({ taskId, documentId: task.documentId }, 'HITL task resolved');
    res.json({ message: 'Task resolved successfully', taskId });
  });

  // GET /api/hitl/tasks/:taskId — Get task details
  router.get('/:taskId', async (req: Request, res: Response) => {
    const { taskId } = req.params;

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
