// Job: let a request through only with a valid access token from `Authorization: Bearer`
// (spec 012 A6). A cookie is never read here. The verified claims go on res.locals.claims.
import type { Request, RequestHandler } from 'express';
import { ApiError } from '../../../common/apiError.js';
import type { SessionCheck } from './sessionCheck.service.js';

const BEARER = /^Bearer ([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*)$/;

// The token from `Authorization: Bearer`, or undefined. Also used by POST /logout.
export const bearerToken = (req: Request): string | undefined => BEARER.exec(req.headers.authorization ?? '')?.[1];

export const requireAccess =
  (sessionCheck: SessionCheck): RequestHandler =>
  async (req, res, next) => {
    const token = bearerToken(req);
    if (!token) throw new ApiError('UNAUTHENTICATED');
    res.locals.claims = await sessionCheck.check(token);
    next();
  };
