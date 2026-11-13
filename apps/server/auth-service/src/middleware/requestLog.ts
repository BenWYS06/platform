// Job: the request logger (pino-http). Keeps a safe client X-Request-Id and masks invitation
// tokens in every line that carries the request or an error (spec 009 A27).
import { randomUUID } from 'node:crypto';
import type { RequestHandler } from 'express';
import type { Logger } from 'pino';
import { pinoHttp } from 'pino-http';

const SAFE_REQUEST_ID = /^[A-Za-z0-9._-]{1,64}$/;
// The token segment of an API path, and of the web invite page (it arrives as Referer).
// Case-insensitive: Express routes are.
const TOKEN_PATHS = [/(\/api\/auth\/invitations\/)[^/?#\s]+/gi, /(\/invite\/)[^/?#\s]+/gi];

export const maskTokens = (text: string): string =>
  TOKEN_PATHS.reduce((out, pattern) => out.replace(pattern, '$1[redacted]'), text);

const maskField = <T extends Record<string, unknown>>(obj: T, key: keyof T): void => {
  if (typeof obj[key] === 'string') obj[key] = maskTokens(obj[key]) as T[keyof T];
};

export function requestLogger(logger: Logger): RequestHandler {
  return pinoHttp({
    logger,
    // Keep a safe client X-Request-Id, otherwise make one; echo it in the response.
    genReqId: (req, res) => {
      const sent = req.headers['x-request-id'];
      const id = typeof sent === 'string' && SAFE_REQUEST_ID.test(sent) ? sent : randomUUID();
      res.setHeader('X-Request-Id', id);
      return id;
    },
    // pino-http wraps these after its own serializers: they get the plain serialized objects.
    serializers: {
      req: (req: { url?: string; headers?: Record<string, unknown> }) => {
        maskField(req, 'url');
        // `headers` is the live request object: copy before masking.
        if (req.headers) {
          req.headers = { ...req.headers };
          maskField(req.headers, 'referer');
        }
        return req;
      },
      err: (err: { message?: string; stack?: string }) => {
        maskField(err, 'message');
        maskField(err, 'stack');
        return err;
      },
    },
  });
}
