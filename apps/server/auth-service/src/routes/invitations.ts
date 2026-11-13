// Job: /api/auth/invitations routes (data routes, mounted behind requireReady). HTTP only:
// token shape and body checks, then one service call.
import { Router } from 'express';
import { z } from 'zod';
import { ApiError } from '../errors.js';
import type { InvitationsService } from '../services/invitations.js';
import { TOKEN_SHAPE } from '../services/tokens.js';

// Length in characters (code points), not UTF-16 units.
const chars = (min: number, max: number) => (s: string) => [...s].length >= min && [...s].length <= max;

const acceptBody = z.strictObject({
  // Used exactly as typed: no trim.
  password: z.string().refine(chars(12, 128)),
  displayName: z.string().trim().refine(chars(1, 64)),
});

export function invitationsRouter(service: InvitationsService): Router {
  const router = Router();
  router.post('/:token/accept-password', async (req, res) => {
    const { token } = req.params;
    // A malformed token answers like an unknown one, with no database call.
    if (!TOKEN_SHAPE.test(token)) throw new ApiError('INVITATION_INVALID');
    const body = acceptBody.parse(req.body);
    const user = await service.acceptWithPassword({ token, ...body });
    res.status(201).json({ user });
  });
  return router;
}
