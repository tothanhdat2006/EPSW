import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createLogger } from '@dvc/logger';
import { disconnectPrisma } from '@dvc/database';
import { config } from './config.js';
import { correlationIdMiddleware, optionalAuth, requireAuth } from './middleware/auth.js';
import { createDocumentsRouter } from './routes/documents.js';
import { createHitlRouter } from './routes/hitl.js';
import { createAiRouter } from './routes/ai.js';
import { startWorkflowWorker, stopWorkflowWorker } from './services/workflow.js';

const logger = createLogger({ service: 'core-api' });

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(correlationIdMiddleware);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'core-api' });
});

app.use('/api/documents', optionalAuth, createDocumentsRouter(logger));
app.use('/api/hitl', requireAuth, createHitlRouter(logger));
app.use('/api/ai', requireAuth, createAiRouter(logger));

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error({ err }, 'Unhandled error');
  res.status(500).json({ error: 'Internal server error' });
});

startWorkflowWorker();

const server = app.listen(config.port, () => {
  logger.info({ port: config.port, env: config.nodeEnv }, 'Core API started');
});

async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, 'Shutting down gracefully');
  server.close(async () => {
    await stopWorkflowWorker();
    await disconnectPrisma();
    process.exit(0);
  });
}

process.on('SIGTERM', () => {
  void shutdown('SIGTERM');
});

process.on('SIGINT', () => {
  void shutdown('SIGINT');
});
