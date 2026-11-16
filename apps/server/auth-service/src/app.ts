// Job: build the Express app (no listen), so tests can call it with supertest.
import express, { type Express, type RequestHandler } from 'express';
import helmet from 'helmet';
import type { Logger } from 'pino';
import { type Config, DEFAULT_ACCESS_TTL_SECONDS, DEFAULT_REFRESH_TTL_SECONDS } from './config.js';
import { createBurstLimit } from './middleware/burstLimit.js';
import { errorHandler, notFound } from './middleware/errors.js';
import { requireInternalKey } from './middleware/internalKey.js';
import { requireReady } from './middleware/ready.js';
import { requestLogger } from './middleware/requestLog.js';
import { authRouter } from './routes/auth.js';
import { healthRouter } from './routes/health.js';
import { internalRouter } from './routes/internal.js';
import { invitationsRouter } from './routes/invitations.js';
import type { AcceptLimit } from './services/acceptLimit.js';
import type { Health } from './services/health.js';
import type { InvitationsService } from './services/invitations.js';
import type { LoginService } from './services/login.js';
import type { Readiness } from './services/startup.js';

export interface AppDeps {
  // trustProxy unset: false; clientIpHeader unset: req.ip decides; TTLs unset: the config defaults.
  config: Pick<Config, 'internalApiKey'> & Partial<Pick<Config, 'trustProxy' | 'clientIpHeader' | 'jwtAccessTtlSeconds' | 'refreshTtlSeconds'>>;
  logger: Logger;
  health: Health;
  // Data routes answer 503 until this says the indexes exist.
  readiness: Readiness;
  invitations: InvitationsService;
  acceptLimit: AcceptLimit;
  login: LoginService;
  // Burst limit on login and accept; server.ts always passes it (createAppWithLimits).
  burstLimit?: RequestHandler;
}

export function createApp({ config, logger, health, readiness, invitations, acceptLimit, login, burstLimit }: AppDeps): Express {
  const app = express();
  // Security headers on every answer, errors and health included (B13).
  app.use(helmet({ frameguard: { action: 'deny' } }));
  app.disable('x-powered-by');
  // req.ip follows TRUST_PROXY: with 1, the last X-Forwarded-For value (added by Caddy) decides.
  app.set('trust proxy', config.trustProxy ?? false);

  app.use(requestLogger(logger));
  app.use(express.json({ limit: '100kb' }));

  app.use('/api/auth', healthRouter(health));
  // One shared limiter for login and accept; never health or /internal (B11).
  if (burstLimit) app.use(['/api/auth/login', '/api/auth/invitations'], burstLimit);
  app.use('/api/auth/invitations', requireReady(readiness), invitationsRouter({ service: invitations, limit: acceptLimit, clientIpHeader: config.clientIpHeader }));
  const cookieMaxAge = { access: config.jwtAccessTtlSeconds ?? DEFAULT_ACCESS_TTL_SECONDS, refresh: config.refreshTtlSeconds ?? DEFAULT_REFRESH_TTL_SECONDS };
  app.use('/api/auth', authRouter({ service: login, ready: requireReady(readiness), clientIpHeader: config.clientIpHeader, cookieMaxAge }));
  app.use('/internal', requireInternalKey(config.internalApiKey), internalRouter());

  app.use(notFound);
  app.use(errorHandler);
  return app;
}

// The app as server.ts runs it: createApp with the burst limit (plan 009b C5).
export function createAppWithLimits(deps: Omit<AppDeps, 'burstLimit'>): Express {
  return createApp({ ...deps, burstLimit: createBurstLimit(deps.config.clientIpHeader) });
}
