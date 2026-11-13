// Job: a real Redis for integration tests (Testcontainers; Docker must be running).
// Same image as infra/docker-compose/compose.yml. Tests use their own key prefix.
import { GenericContainer, type StartedTestContainer, Wait } from 'testcontainers';

const IMAGE = 'redis:7.4.6';

export interface TestRedis {
  url: string;
  stop(): Promise<void>;
}

export async function startRedis(): Promise<TestRedis> {
  const container: StartedTestContainer = await new GenericContainer(IMAGE)
    .withExposedPorts(6379)
    .withWaitStrategy(Wait.forLogMessage(/Ready to accept connections/))
    .start();
  return {
    url: `redis://${container.getHost()}:${container.getMappedPort(6379)}`,
    stop: async () => {
      await container.stop();
    },
  };
}

// Polls `check` until it is true or `timeoutMs` passes (no fixed sleeps in tests).
export async function waitFor(check: () => boolean, timeoutMs = 10_000): Promise<void> {
  const end = Date.now() + timeoutMs;
  while (!check()) {
    if (Date.now() > end) throw new Error('condition not reached in time');
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
}
