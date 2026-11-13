// Job: stubs for app tests: an invitations service that must never be reached, and an accept
// limit that never blocks.
import type { AcceptLimit } from '../../src/services/acceptLimit.js';
import type { InvitationsService } from '../../src/services/invitations.js';

export const unusedInvitations: InvitationsService = {
  acceptWithPassword: () => Promise.reject(new Error('the invitations service must not be called in this test')),
};

export const noLimit: AcceptLimit = { check: async () => {}, fail: async () => {} };
