// Job: /api/auth/invitations routes (data routes, mounted behind requireReady). HTTP only:
// token shape, failure limit, body, then one service call (spec 009 A23).
import { Router } from 'express';
import { z } from 'zod';
import { ApiError, type ErrorCode } from '../errors.js';
import { clientIp } from '../middleware/clientIp.js';
import type { AcceptLimit } from '../services/acceptLimit.js';
import type { InvitationsService } from '../services/invitations.js';
import { TOKEN_SHAPE } from '../services/tokens.js';

// Length in characters (code points), not UTF-16 units.
const chars = (min: number, max: number) => (s: string) => [...s].length >= min && [...s].length <= max;

// Token-check answers count toward the limit; bad input and MEMBER_ALREADY_EXISTS do not.
const TOKEN_FAILURES = new Set<ErrorCode>([
  'INVITATION_INVALID',
  'INVITATION_EXPIRED',
  'INVITATION_REVOKED',
  'INVITATION_ALREADY_ACCEPTED',
]);

const acceptBody = z.strictObject({
  // Used exactly as typed: no trim.
  password: z.string().refine(chars(12, 128)),
  displayName: z.string().trim().refine(chars(1, 64)),
});

export interface InvitationsRouterDeps {
  service: InvitationsService;
  limit: AcceptLimit;
  clientIpHeader?: string;
}

export function invitationsRouter({ service, limit, clientIpHeader }: InvitationsRouterDeps): Router {
  const router = Router();
  router.post('/:token/accept-password', async (req, res) => {
    const { token } = req.params;
    const ip = clientIp(req, clientIpHeader);
    // A malformed token answers like an unknown one, with no database call; it counts as a failure.
    if (!TOKEN_SHAPE.test(token)) {
      await limit.fail(ip);
      throw new ApiError('INVITATION_INVALID');
    }
    await limit.check(ip);
    const body = acceptBody.parse(req.body);
    try {
      const user = await service.acceptWithPassword({ token, ...body });
      res.status(201).json({ user });
    } catch (e) {
      if (e instanceof ApiError && TOKEN_FAILURES.has(e.code)) await limit.fail(ip);
      throw e;
    }
  });
  return router;
}
