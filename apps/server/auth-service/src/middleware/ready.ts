// Job: answer 503 SERVICE_UNAVAILABLE on data routes until the startup indexes exist.
import type { RequestHandler } from 'express';
import type { Readiness } from '../services/startup.js';
import { send } from './errors.js';

export const requireReady =
  (readiness: Readiness): RequestHandler =>
  (_req, res, next) => {
    if (!readiness.isReady()) return send(res, 'SERVICE_UNAVAILABLE');
    next();
  };
