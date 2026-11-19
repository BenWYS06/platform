// Job: revoke sessions and mark claims stale, then tell other services (spec 012 B8; plan 012b
// D2, D4, D10, D11). The Redis change comes first, then the publish. Channel names and payloads
// are built only here; callers pass plain values. A failed publish writes one warn line with
// the channel and never fails the call. Payloads hold no token or hash.
import type { Logger } from 'pino';
import type { RevokeReason, SessionStore } from './session.repository.js';

// Values match contracts/messaging.json (test/contract.test.ts).
export const SESSIONS_REVOKED_CHANNEL = 'auth:sessions-revoked';
export const CLAIMS_CHANGED_CHANNEL = 'auth:claims-changed';

export interface RevokedEvent {
  userId: string;
  sid: string;
  reason: RevokeReason;
}

export interface SessionRevoker {
  // true when this call revoked the session; publishes only then (D4).
  revokeSession(sid: string, reason: RevokeReason, expectedUserId?: string): Promise<boolean>;
  // Both publish once per user and return how many sessions changed.
  revokeAllSessions(userId: string, reason: RevokeReason): Promise<number>;
  markClaimsStale(userId: string): Promise<number>;
  // Publish only, no Redis change: the rotate script has already revoked (D11).
  announceRevoked(event: RevokedEvent): Promise<void>;
}

export interface SessionRevokerDeps {
  sessions: Pick<SessionStore, 'readForCheck' | 'revoke' | 'revokeAllOfUser' | 'markClaimsStale'>;
  // The Redis client in the app; a fake in tests.
  publisher: { publish(channel: string, message: string): Promise<unknown> };
  logger: Logger;
}

export function createSessionRevoker(deps: SessionRevokerDeps): SessionRevoker {
  const { sessions, publisher, logger } = deps;

  async function publish(channel: string, payload: object): Promise<void> {
    try {
      await publisher.publish(channel, JSON.stringify(payload));
    } catch (e) {
      logger.warn({ channel, error: e instanceof Error ? e.name : 'unknown' }, 'event publish failed');
    }
  }

  const announceRevoked = ({ userId, sid, reason }: RevokedEvent) =>
    publish(SESSIONS_REVOKED_CHANNEL, { userId, sid, reason });

  return {
    async revokeSession(sid, reason, expectedUserId) {
      // The event names the owner, so read it first; a missing session changes nothing.
      const session = await sessions.readForCheck(sid);
      if (!session) return false;
      const changed = await sessions.revoke(sid, reason, expectedUserId ?? session.userId);
      if (changed) await announceRevoked({ userId: session.userId, sid, reason });
      return changed;
    },

    async revokeAllSessions(userId, reason) {
      const n = await sessions.revokeAllOfUser(userId, reason);
      await publish(SESSIONS_REVOKED_CHANNEL, { userId, reason });
      return n;
    },

    async markClaimsStale(userId) {
      const n = await sessions.markClaimsStale(userId);
      await publish(CLAIMS_CHANGED_CHANNEL, { userId });
      return n;
    },

    announceRevoked,
  };
}
