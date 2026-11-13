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
import type { AcceptLimit } from './services/acceptLimit.js';
import type { Health } from './services/health.js';
import type { InvitationsService } from './services/invitations.js';
import type { Readiness } from './services/startup.js';

export interface AppDeps {
  // trustProxy unset: false; clientIpHeader unset: req.ip decides.
  config: Pick<Config, 'internalApiKey'> & Partial<Pick<Config, 'trustProxy' | 'clientIpHeader'>>;
  logger: Logger;
  health: Health;
  // Data routes answer 503 until this says the indexes exist.
  readiness: Readiness;
  invitations: InvitationsService;
  acceptLimit: AcceptLimit;
}

export function createApp({ config, logger, health, readiness, invitations, acceptLimit }: AppDeps): Express {
  const app = express();
  app.disable('x-powered-by');
  // req.ip follows TRUST_PROXY: with 1, the last X-Forwarded-For value (added by Caddy) decides.
  app.set('trust proxy', config.trustProxy ?? false);

  app.use(requestLogger(logger));
  app.use(express.json({ limit: '100kb' }));

  app.use('/api/auth', healthRouter(health));
  app.use('/api/auth/invitations', requireReady(readiness), invitationsRouter({ service: invitations, limit: acceptLimit, clientIpHeader: config.clientIpHeader }));
  app.use('/internal', requireInternalKey(config.internalApiKey), internalRouter());

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
