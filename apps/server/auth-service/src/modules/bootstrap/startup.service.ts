// Job: the one startup retry loop. It creates the indexes, then runs the after-index step
// (the boot step), retrying every `retryMs` while MongoDB is down. The service serves meanwhile:
// data routes answer 503 until the indexes exist (isReady), health answers from the start.
import type { Logger } from 'pino';

export interface Readiness {
  // True once every index exists; data routes answer only then.
  isReady(): boolean;
}

export interface StartupLoop extends Readiness {
  start(): void;
  stop(): void;
  // Resolves when every step has run once.
  done(): Promise<void>;
}

export interface StartupSteps {
  ensureIndexes(): Promise<void>;
  afterIndexes?(): Promise<void>;
}

export const DEFAULT_RETRY_MS = 30_000;

export function createStartupLoop(steps: StartupSteps, logger: Logger, retryMs = DEFAULT_RETRY_MS): StartupLoop {
  let indexesDone = false;
  let afterDone = !steps.afterIndexes;
  let stopped = false;
  let timer: NodeJS.Timeout | undefined;
  let resolveDone: () => void = () => {};
  const finished = new Promise<void>((resolve) => (resolveDone = resolve));

  async function run(): Promise<void> {
    try {
      if (!indexesDone) {
        await steps.ensureIndexes();
        indexesDone = true;
        logger.info('indexes ready');
      }
      if (!afterDone && steps.afterIndexes) {
        await steps.afterIndexes();
        afterDone = true;
      }
      resolveDone();
    } catch (e) {
      // Error type only: driver messages can carry hosts or URIs.
      logger.warn({ error: e instanceof Error ? e.name : 'unknown', retryInMs: retryMs }, 'startup step failed; retrying');
      if (!stopped) timer = setTimeout(() => void run(), retryMs);
    }
  }

  return {
    isReady: () => indexesDone,
    start() {
      void run();
    },
    stop() {
      stopped = true;
      clearTimeout(timer);
    },
    done: () => finished,
  };
}
