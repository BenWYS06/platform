// Job: the burst limit (spec 009 B3, B11; plan 009b C3; spec 012 B7, plan 012b D8): a limit per
// second per client IP, 5 for login and accept, 100 for refresh, each its own instance,
// memory store (per process, resets on restart; fine for one instance, A24). Over the limit:
// 429 RATE_LIMITED with retryAfterSeconds 1, sent by the error handler with Retry-After: 1.
import type { RequestHandler } from 'express';
import { ipKeyGenerator, rateLimit } from 'express-rate-limit';
import { ApiError } from '../errors.js';
import { clientIp } from './clientIp.js';

export const BURST_LIMIT = 5;
export const REFRESH_BURST_LIMIT = 100;
export const BURST_WINDOW_MS = 1000;

export function createBurstLimit(clientIpHeader: string | undefined, limit = BURST_LIMIT): RequestHandler {
  return rateLimit({
    windowMs: BURST_WINDOW_MS,
    limit,
    standardHeaders: false,
    legacyHeaders: false,
    // The same client IP as the failure limits; IPv6 grouped by its /56 network.
    keyGenerator: (req) => ipKeyGenerator(clientIp(req, clientIpHeader)),
    handler: (_req, _res, next) => next(new ApiError('RATE_LIMITED', { retryAfterSeconds: 1 })),
  });
}
