// Job: GET /api/auth/health, public. 200 { "status": "UP" } when every store answers,
// otherwise 503 { "status": "DOWN" } with no detail (D-010b: the one route whose 503 is not
// the contract error body).
import { Router } from 'express';
import type { Health } from '../services/health.js';

export function healthRouter(health: Health): Router {
  const router = Router();
  router.get('/health', async (_req, res) => {
    const up = await health.allUp();
    res.status(up ? 200 : 503).json({ status: up ? 'UP' : 'DOWN' });
  });
  return router;
}
