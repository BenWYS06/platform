// Job: stubs for app tests: invitations and login services that must never be reached, and an
// accept limit that never blocks.
import type { AcceptLimit } from '../../src/services/acceptLimit.js';
import type { InvitationsService } from '../../src/services/invitations.js';
import type { LoginService } from '../../src/services/login.js';

export const unusedInvitations: InvitationsService = {
  acceptWithPassword: () => Promise.reject(new Error('the invitations service must not be called in this test')),
};

export const noLimit: AcceptLimit = { check: async () => {}, fail: async () => {} };

export const unusedLogin: LoginService = {
  login: () => Promise.reject(new Error('the login service must not be called in this test')),
};
