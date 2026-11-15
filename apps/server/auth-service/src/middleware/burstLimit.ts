// Job: the burst limit (spec 009 B3, B11; plan 009b C3): 5 requests per second per client IP,
// memory store (per process, resets on restart; fine for one instance, A24). Over the limit:
// 429 RATE_LIMITED with retryAfterSeconds 1, sent by the error handler with Retry-After: 1.
import type { RequestHandler } from 'express';
import { ipKeyGenerator, rateLimit } from 'express-rate-limit';
import { ApiError } from '../errors.js';
import { clientIp } from './clientIp.js';

export const BURST_LIMIT = 5;
export const BURST_WINDOW_MS = 1000;

export function createBurstLimit(clientIpHeader: string | undefined): RequestHandler {
  return rateLimit({
    windowMs: BURST_WINDOW_MS,
    limit: BURST_LIMIT,
    standardHeaders: false,
    legacyHeaders: false,
    // The same client IP as the failure limits; IPv6 grouped by its /56 network.
    keyGenerator: (req) => ipKeyGenerator(clientIp(req, clientIpHeader)),
    handler: (_req, _res, next) => next(new ApiError('RATE_LIMITED', { retryAfterSeconds: 1 })),
  });
}
