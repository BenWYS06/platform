// Job: ping every store in parallel and say whether all answered within the timeout.
// A store that hangs cannot hold the answer past the timeout.
import type { Logger } from 'pino';

export interface StoreCheck {
  name: string;
  check(): Promise<void>;
}

export interface Health {
  allUp(): Promise<boolean>;
}

export const DEFAULT_TIMEOUT_MS = 2500;

export function createHealth(checks: StoreCheck[], logger: Logger, timeoutMs = DEFAULT_TIMEOUT_MS): Health {
  const run = async ({ name, check }: StoreCheck): Promise<boolean> => {
    let timer: NodeJS.Timeout | undefined;
    const timedOut = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('timeout')), timeoutMs);
    });
    try {
      await Promise.race([check(), timedOut]);
      return true;
    } catch (e) {
      // Store name and error type only: driver messages can carry hosts or URIs.
      logger.warn({ store: name, error: e instanceof Error ? e.name : 'unknown', timedOut: e instanceof Error && e.message === 'timeout' }, 'store check failed');
      return false;
    } finally {
      clearTimeout(timer);
    }
  };

  return {
    async allUp() {
      const results = await Promise.all(checks.map(run));
      return results.every(Boolean);
    },
  };
}
