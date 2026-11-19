// Job: build the Express app (no listen), so tests can call it with supertest.
import cookieParser from 'cookie-parser';
import express, { type Express, type RequestHandler } from 'express';
import helmet from 'helmet';
import type { Logger } from 'pino';
import { type Config, DEFAULT_ACCESS_TTL_SECONDS, DEFAULT_REFRESH_TTL_SECONDS } from './config.js';
import { createBurstLimit, REFRESH_BURST_LIMIT } from './middleware/burstLimit.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';
import { requireInternalKey } from './middleware/internalKey.js';
import { requireReady } from './middleware/ready.js';
import { requestLogger } from './middleware/requestLog.js';
import { authRouter, type LoginService, type LogoutService, type RefreshService, type SessionService } from './modules/auth/index.js';
import { healthRouter } from './routes/health.js';
import { internalRouter } from './routes/internal.js';
import { invitationsRouter, type AcceptLimit, type InvitationsService } from './modules/invitations/index.js';
import type { Health } from './services/health.js';
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
  // GET /session and GET /me; server.ts always passes it. Unset: neither route is mounted.
  session?: SessionService;
  // POST /refresh; server.ts always passes it. Unset: the route is not mounted.
  refresh?: RefreshService;
  // POST /logout; server.ts always passes it. Unset: the route is not mounted.
  logout?: LogoutService;
  // Burst limit on login and accept; server.ts always passes it (createAppWithLimits).
  burstLimit?: RequestHandler;
  // Its own burst instance on refresh only, 100 per second (D8).
  refreshBurstLimit?: RequestHandler;
}

export function createApp({ config, logger, health, readiness, invitations, acceptLimit, login, session, refresh, logout, burstLimit, refreshBurstLimit }: AppDeps): Express {
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
  if (refreshBurstLimit) app.use('/api/auth/refresh', refreshBurstLimit);
  app.use('/api/auth/invitations', requireReady(readiness), invitationsRouter({ service: invitations, limit: acceptLimit, clientIpHeader: config.clientIpHeader }));
  const cookieMaxAge = { access: config.jwtAccessTtlSeconds ?? DEFAULT_ACCESS_TTL_SECONDS, refresh: config.refreshTtlSeconds ?? DEFAULT_REFRESH_TTL_SECONDS };
  // Cookies are read only under /api/auth (accessToken for GET /session, refreshToken for refresh).
  app.use('/api/auth', cookieParser());
  app.use('/api/auth', authRouter({ service: login, ready: requireReady(readiness), clientIpHeader: config.clientIpHeader, cookieMaxAge, session, refresh, logout }));
  app.use('/internal', requireInternalKey(config.internalApiKey), internalRouter());

  app.use(notFound);
  app.use(errorHandler);
  return app;
}

// The app as server.ts runs it: createApp with both burst limits (plan 009b C5, plan 012b D8).
export function createAppWithLimits(deps: Omit<AppDeps, 'burstLimit' | 'refreshBurstLimit'>): Express {
  const { clientIpHeader } = deps.config;
  return createApp({ ...deps, burstLimit: createBurstLimit(clientIpHeader), refreshBurstLimit: createBurstLimit(clientIpHeader, REFRESH_BURST_LIMIT) });
}
