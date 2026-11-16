// Job: POST /api/auth/login (spec 009 B1, B8, B9; spec 012 A4, A13). HTTP only: strict body,
// client IP, platform from X-Client, one service call. Bad input answers 400 and is not counted
// as a failure. With X-Client: web both tokens go in cookies and the refresh token never in the
// body; any other client gets no cookie and the refresh token in the body.
import { type CookieOptions, type RequestHandler, Router } from 'express';
import { z } from 'zod';
import { clientIp } from '../middleware/clientIp.js';
import type { LoginService } from '../services/login.js';
import { chars } from './chars.js';

const loginBody = z.strictObject({
  // Trimmed and lower case before the format check and the lookup (B9).
  email: z.string().trim().toLowerCase().max(254).pipe(z.email()),
  // Used exactly as typed: no trim (A18).
  password: z.string().refine(chars(12, 128)),
});

const COOKIE: CookieOptions = { httpOnly: true, secure: true, sameSite: 'lax', path: '/api/auth' };

export interface AuthRouterDeps {
  service: LoginService;
  // Readiness gate: data routes answer 503 until the indexes exist.
  ready: RequestHandler;
  clientIpHeader?: string;
  // Cookie max ages in seconds: the access TTL and the refresh TTL.
  cookieMaxAge: { access: number; refresh: number };
}

export function authRouter({ service, ready, clientIpHeader, cookieMaxAge }: AuthRouterDeps): Router {
  const router = Router();
  router.post('/login', ready, async (req, res) => {
    const body = loginBody.parse(req.body);
    const web = req.get('x-client') === 'web';
    const { accessToken, refreshToken, user } = await service.login({ ...body, ip: clientIp(req, clientIpHeader), platform: web ? 'web' : 'other' });
    if (!web) {
      res.status(200).json({ accessToken, refreshToken, user });
      return;
    }
    res.cookie('accessToken', accessToken, { ...COOKIE, maxAge: cookieMaxAge.access * 1000 });
    res.cookie('refreshToken', refreshToken, { ...COOKIE, maxAge: cookieMaxAge.refresh * 1000 });
    res.status(200).json({ accessToken, user });
  });
  return router;
}
