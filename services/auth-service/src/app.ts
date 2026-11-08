// Job: build the Express app (no listen), so tests can call it with supertest.
import { randomUUID } from 'node:crypto';
import express, { type Express } from 'express';
import type { Logger } from 'pino';
import { pinoHttp } from 'pino-http';
import type { Config } from './config.js';
import { errorHandler, notFound } from './middleware/errors.js';
import { requireInternalKey } from './middleware/internalKey.js';
import { healthRouter } from './routes/health.js';
import { internalRouter } from './routes/internal.js';
import type { Health } from './services/health.js';

const SAFE_REQUEST_ID = /^[A-Za-z0-9._-]{1,64}$/;

export interface AppDeps {
  config: Pick<Config, 'internalApiKey'>;
  logger: Logger;
  health: Health;
}

export function createApp({ config, logger, health }: AppDeps): Express {
  const app = express();
  app.disable('x-powered-by');

  app.use(
    pinoHttp({
      logger,
      // Keep a safe client X-Request-Id, otherwise make one; echo it in the response.
      genReqId: (req, res) => {
        const sent = req.headers['x-request-id'];
        const id = typeof sent === 'string' && SAFE_REQUEST_ID.test(sent) ? sent : randomUUID();
        res.setHeader('X-Request-Id', id);
        return id;
      },
    }),
  );
  app.use(express.json({ limit: '100kb' }));

  app.use('/api/auth', healthRouter(health));
  app.use('/internal', requireInternalKey(config.internalApiKey), internalRouter());

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
