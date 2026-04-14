import pino, { Logger, LoggerOptions } from 'pino';

export interface LoggerContext {
  service: string;
  correlationId?: string;
  documentId?: string;
  trackingCode?: string;
  [key: string]: unknown;
}

const BASE_OPTIONS: LoggerOptions = {
  formatters: {
    level(label) {
      return { level: label };
    },
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  messageKey: 'message',
};

/**
 * Creates a structured JSON logger bound to a named service.
 * All log entries include `service`, `correlation_id`, and ISO timestamp.
 */
export function createLogger(context: LoggerContext): Logger {
  const { service, correlationId, ...rest } = context;

  return pino({
    ...BASE_OPTIONS,
    base: {
      service,
      correlation_id: correlationId ?? 'unset',
      ...rest,
    },
    level: process.env['LOG_LEVEL'] ?? 'info',
  });
}

/**
 * Returns a child logger with an updated correlationId and optional extra fields.
 * Use this within request handlers to propagate trace context.
 */
export function withCorrelation(
  logger: Logger,
  correlationId: string,
  extra?: Record<string, unknown>,
): Logger {
  return logger.child({ correlation_id: correlationId, ...extra });
}

export type { Logger };
