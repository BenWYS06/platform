// Job: /api/auth/invitations routes (data routes, mounted behind requireReady).
// Empty until the accept route is added; until then every path here answers 404 once ready.
import { Router } from 'express';

export function invitationsRouter(): Router {
  return Router();
}
