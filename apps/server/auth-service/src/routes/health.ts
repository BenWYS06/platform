// Job: GET /api/auth/health, public. 200 { "status": "UP" } when every store answers,
// otherwise 503 { "code": "SERVICE_UNAVAILABLE" } with no detail.
import { Router } from 'express';
import { ApiError } from '../errors.js';
import type { Health } from '../services/health.js';

export function healthRouter(health: Health): Router {
  const router = Router();
  router.get('/health', async (_req, res) => {
    if (!(await health.allUp())) throw new ApiError('SERVICE_UNAVAILABLE');
    res.json({ status: 'UP' });
  });
  return router;
}
