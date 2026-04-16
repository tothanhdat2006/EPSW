import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { createLogger } from '@dvc/logger';
import { disconnectPrisma } from '@dvc/database';
import { config } from './config.js';
import { requireAuth, correlationIdMiddleware } from './middleware/auth.js';
import { createDocumentRouter } from './routes/document.js';
import { disconnectProducer } from './services/kafka.js';

const logger = createLogger({ service: 'ingestion-service' });

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(correlationIdMiddleware);

app.use(
  rateLimit({
    windowMs: 60 * 1000,
    max: 100,
    message: { error: 'Too many requests, please try again later.' },
  }),
);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'ingestion-service' });
});

app.use('/api/documents', requireAuth, createDocumentRouter(logger));

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error({ err }, 'Unhandled error');
  res.status(500).json({ error: 'Internal server error' });
});

const server = app.listen(config.port, () => {
  logger.info({ port: config.port, env: config.nodeEnv }, 'Ingestion service started');
});

async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, 'Shutting down gracefully');
  server.close(async () => {
    await disconnectProducer();
    await disconnectPrisma();
    process.exit(0);
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
