// Job: /internal routes, for other services only. Mounted behind requireInternalKey.
import { Router } from 'express';

export function internalRouter(): Router {
  const router = Router();
  router.get('/ping', (_req, res) => {
    res.json({ status: 'OK' });
  });
  return router;
}
