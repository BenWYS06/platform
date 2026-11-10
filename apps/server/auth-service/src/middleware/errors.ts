// Job: answer unknown routes and every thrown error as { code } with the contract status.
// Never sends a stack trace or an error message.
import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import { ApiError, ERROR_STATUS, type ErrorCode } from '../errors.js';

export function send(res: Parameters<RequestHandler>[1], code: ErrorCode): void {
  res.status(ERROR_STATUS[code]).json({ code });
}

export const notFound: RequestHandler = (_req, res) => send(res, 'NOT_FOUND');

export const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
  if (res.headersSent) return next(err);
  if (err instanceof ApiError) return send(res, err.code);
  // Body parser errors (bad JSON, too large) and schema failures are bad input.
  const parserError = typeof err === 'object' && err !== null && 'type' in err && 'status' in err && Number(err.status) < 500;
  if (err instanceof ZodError || parserError) return send(res, 'VALIDATION_FAILED');
  req.log.error({ err }, 'unexpected error');
  send(res, 'INTERNAL');
};
