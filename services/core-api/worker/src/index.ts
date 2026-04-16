import { workerApp } from './app.js';
import { runSlaEscalationCron, handleQueueBatch } from './queue.js';
import type { WorkerEnv } from './env.js';
import type { WorkflowQueueMessage } from './types.js';

export default {
  fetch(request: Request, env: WorkerEnv, executionContext: ExecutionContext): Promise<Response> {
    return workerApp.fetch(request, env, executionContext);
  },

  async queue(
    batch: MessageBatch<WorkflowQueueMessage>,
    env: WorkerEnv,
    _executionContext: ExecutionContext,
  ): Promise<void> {
    await handleQueueBatch(batch, env);
  },

  async scheduled(_event: ScheduledEvent, env: WorkerEnv, executionContext: ExecutionContext): Promise<void> {
    executionContext.waitUntil(runSlaEscalationCron(env));
  },
};
