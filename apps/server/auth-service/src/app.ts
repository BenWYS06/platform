// Job: build the Express app (no listen), so tests can call it with supertest.
import express, { type Express } from 'express';
import type { Logger } from 'pino';
import type { Config } from './config.js';
import { errorHandler, notFound } from './middleware/errors.js';
import { requireInternalKey } from './middleware/internalKey.js';
import { requireReady } from './middleware/ready.js';
import { requestLogger } from './middleware/requestLog.js';
import { healthRouter } from './routes/health.js';
import { internalRouter } from './routes/internal.js';
import { invitationsRouter } from './routes/invitations.js';
import type { Health } from './services/health.js';
import type { Readiness } from './services/startup.js';

export interface AppDeps {
  config: Pick<Config, 'internalApiKey'>;
  logger: Logger;
  health: Health;
  // Data routes answer 503 until this says the indexes exist.
  readiness: Readiness;
}

export function createApp({ config, logger, health, readiness }: AppDeps): Express {
  const app = express();
  app.disable('x-powered-by');

  app.use(requestLogger(logger));
  app.use(express.json({ limit: '100kb' }));

  app.use('/api/auth', healthRouter(health));
  app.use('/api/auth/invitations', requireReady(readiness), invitationsRouter());
  app.use('/internal', requireInternalKey(config.internalApiKey), internalRouter());

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
