import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createLogger } from '@dvc/logger';
import { config } from './config.js';
import { startNotificationConsumer } from './consumers/notification-events.js';

const logger = createLogger({ service: 'notification-service' });

const app = express();
app.use(helmet());
app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'notification-service' });
});

startNotificationConsumer().catch((err) => {
  logger.error({ err }, 'Notification consumer failed to start');
  process.exit(1);
});

const server = app.listen(config.port, () => {
  logger.info({ port: config.port }, 'Notification service started');
});

process.on('SIGTERM', () => server.close(() => process.exit(0)));
process.on('SIGINT', () => server.close(() => process.exit(0)));
