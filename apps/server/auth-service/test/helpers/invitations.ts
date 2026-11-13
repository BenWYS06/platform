// Job: an invitations service for app tests that must never reach it.
import type { InvitationsService } from '../../src/services/invitations.js';

export const unusedInvitations: InvitationsService = {
  acceptWithPassword: () => Promise.reject(new Error('the invitations service must not be called in this test')),
};
