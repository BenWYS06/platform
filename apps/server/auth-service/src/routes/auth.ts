// Job: POST /api/auth/login (spec 009 B1, B8, B9). HTTP only: strict body, client IP, one
// service call. Bad input answers 400 and is not counted as a failure.
import { type RequestHandler, Router } from 'express';
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

export interface AuthRouterDeps {
  service: LoginService;
  // Readiness gate: data routes answer 503 until the indexes exist.
  ready: RequestHandler;
  clientIpHeader?: string;
}

export function authRouter({ service, ready, clientIpHeader }: AuthRouterDeps): Router {
  const router = Router();
  router.post('/login', ready, async (req, res) => {
    const body = loginBody.parse(req.body);
    const result = await service.login({ ...body, ip: clientIp(req, clientIpHeader) });
    res.status(200).json(result);
  });
  return router;
}
