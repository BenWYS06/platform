// Job: let a request through only with a valid access token from `Authorization: Bearer`
// (spec 012 A6). A cookie is never read here. The verified claims go on res.locals.claims.
import type { RequestHandler } from 'express';
import { ApiError } from '../errors.js';
import type { SessionCheck } from '../services/sessionCheck.js';

const BEARER = /^Bearer ([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*)$/;

export const requireAccess =
  (sessionCheck: SessionCheck): RequestHandler =>
  async (req, res, next) => {
    const match = BEARER.exec(req.headers.authorization ?? '');
    if (!match) throw new ApiError('UNAUTHENTICATED');
    res.locals.claims = await sessionCheck.check(match[1]);
    next();
  };
