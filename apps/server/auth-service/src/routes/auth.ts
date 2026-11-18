// Job: POST /api/auth/login (spec 009 B1, B8, B9; spec 012 A4, A13). HTTP only: strict body,
// client IP, platform from X-Client, one service call. Bad input answers 400 and is not counted
// as a failure. With X-Client: web both tokens go in cookies and the refresh token never in the
// body; any other client gets no cookie and the refresh token in the body.
// POST /refresh (spec 012 B10; plan 012b D6): the token from the refreshToken cookie, else from
// a strict body; web gets both cookies again, any other client the new refresh token in the body.
// GET /session (A5): the access token only from the accessToken cookie. GET /me (A6): only from
// Authorization: Bearer, through requireAccess.
import { type CookieOptions, type RequestHandler, type Response, Router } from 'express';
import { z } from 'zod';
import { ApiError } from '../errors.js';
import { clientIp } from '../middleware/clientIp.js';
import { requireAccess } from '../middleware/requireAccess.js';
import type { LoginResult, LoginService } from '../services/login.js';
import type { RefreshService } from '../services/refresh.js';
import type { SessionService } from '../services/session.js';
import type { VerifiedClaims } from '../services/sessionTokens.js';
import { chars } from './chars.js';

const loginBody = z.strictObject({
  // Trimmed and lower case before the format check and the lookup (B9).
  email: z.string().trim().toLowerCase().max(254).pipe(z.email()),
  // Used exactly as typed: no trim (A18).
  password: z.string().refine(chars(12, 128)),
});

// The service checks the token's shape; the length cap only bounds the input.
const refreshBody = z.strictObject({ refreshToken: z.string().max(256).optional() });

const COOKIE: CookieOptions = { httpOnly: true, secure: true, sameSite: 'lax', path: '/api/auth' };

export interface AuthRouterDeps {
  service: LoginService;
  // Readiness gate: data routes answer 503 until the indexes exist.
  ready: RequestHandler;
  clientIpHeader?: string;
  // Cookie max ages in seconds: the access TTL and the refresh TTL.
  cookieMaxAge: { access: number; refresh: number };
  // Unset: /session and /me are not mounted (route tests that do not need them).
  session?: SessionService;
  // Unset: /refresh is not mounted.
  refresh?: RefreshService;
}

export function authRouter({ service, ready, clientIpHeader, cookieMaxAge, session, refresh }: AuthRouterDeps): Router {
  const router = Router();

  // Login and refresh answer the same way: cookies for web, the refresh token in the body else.
  function sendTokens(res: Response, web: boolean, { accessToken, refreshToken, user }: LoginResult): void {
    if (!web) {
      res.status(200).json({ accessToken, refreshToken, user });
      return;
    }
    res.cookie('accessToken', accessToken, { ...COOKIE, maxAge: cookieMaxAge.access * 1000 });
    res.cookie('refreshToken', refreshToken, { ...COOKIE, maxAge: cookieMaxAge.refresh * 1000 });
    res.status(200).json({ accessToken, user });
  }

  router.post('/login', ready, async (req, res) => {
    const body = loginBody.parse(req.body);
    const web = req.get('x-client') === 'web';
    sendTokens(res, web, await service.login({ ...body, ip: clientIp(req, clientIpHeader), platform: web ? 'web' : 'other' }));
  });

  if (refresh) {
    router.post('/refresh', ready, async (req, res) => {
      const body = refreshBody.parse(req.body ?? {});
      const cookie: unknown = req.cookies?.refreshToken;
      const token = typeof cookie === 'string' && cookie !== '' ? cookie : body.refreshToken;
      sendTokens(res, req.get('x-client') === 'web', await refresh.refresh(token));
    });
  }
  if (!session) return router;

  router.get('/session', ready, async (req, res) => {
    const token: unknown = req.cookies?.accessToken;
    if (typeof token !== 'string' || token === '') throw new ApiError('UNAUTHENTICATED');
    res.status(200).json(await session.restore(token));
  });
  router.get('/me', ready, requireAccess(session), async (_req, res) => {
    res.status(200).json({ user: await session.me(res.locals.claims as VerifiedClaims) });
  });
  return router;
}
