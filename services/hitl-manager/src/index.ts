import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createLogger } from '@dvc/logger';
import { disconnectPrisma } from '@dvc/database';
import { config } from './config.js';
import { requireAuth, correlationMiddleware } from './middleware/auth.js';
import { createTasksRouter } from './routes/tasks.js';
import { startHitlConsumer } from './consumers/hitl-events.js';

const logger = createLogger({ service: 'hitl-manager' });

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(correlationMiddleware);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'hitl-manager' });
});

app.use('/api/hitl/tasks', requireAuth, createTasksRouter(logger));

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error({ err }, 'Unhandled error');
  res.status(500).json({ error: 'Internal server error' });
});

// Start Kafka consumer for HITL events
startHitlConsumer().catch((err) => {
  logger.error({ err }, 'HITL consumer failed to start');
  process.exit(1);
});

const server = app.listen(config.port, () => {
  logger.info({ port: config.port }, 'HITL Manager started');
});

async function shutdown(): Promise<void> {
  server.close(async () => {
    await disconnectPrisma();
    process.exit(0);
  });
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
