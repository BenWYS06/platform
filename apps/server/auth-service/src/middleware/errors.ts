// Job: answer unknown routes and every thrown error as { code, params? } with the contract status.
// Never sends a stack trace or an error message.
import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import { ApiError, ERROR_STATUS, type ErrorCode, type ErrorParams } from '../errors.js';
import { StoreUnavailableError } from '../repositories/errors.js';

export function send(res: Parameters<RequestHandler>[1], code: ErrorCode, params?: ErrorParams): void {
  res.status(ERROR_STATUS[code]).json(params ? { code, params } : { code });
}

export const notFound: RequestHandler = (_req, res) => send(res, 'NOT_FOUND');

export const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
  if (res.headersSent) return next(err);
  if (err instanceof ApiError) {
    // A 429 carries Retry-After equal to params.retryAfterSeconds (A14).
    const retry = err.params?.retryAfterSeconds;
    if (err.code === 'RATE_LIMITED' && typeof retry === 'number') res.setHeader('Retry-After', String(retry));
    return send(res, err.code, err.params);
  }
  if (err instanceof StoreUnavailableError) return send(res, 'SERVICE_UNAVAILABLE');
  // Body parser errors (bad JSON, too large) and schema failures are bad input.
  const parserError = typeof err === 'object' && err !== null && 'type' in err && 'status' in err && Number(err.status) < 500;
  if (err instanceof ZodError || parserError) return send(res, 'VALIDATION_FAILED');
  req.log.error({ err }, 'unexpected error');
  send(res, 'INTERNAL');
};
