// Job: a real MongoDB for integration tests (Testcontainers; Docker must be running).
// Same image as infra/docker-compose/compose.yml. Each test uses its own database name.
import { randomUUID } from 'node:crypto';
import net from 'node:net';
import { GenericContainer, type StartedTestContainer, Wait } from 'testcontainers';

const IMAGE = 'mongo:8.0.17';
export const START_TIMEOUT_MS = 120_000;

export interface TestMongo {
  uri: string;
  stop(): Promise<void>;
}

// Starts MongoDB on a random host port, or on `hostPort` when given.
export async function startMongo(hostPort?: number): Promise<TestMongo> {
  const container: StartedTestContainer = await new GenericContainer(IMAGE)
    .withExposedPorts(hostPort ? { container: 27017, host: hostPort } : 27017)
    .withWaitStrategy(Wait.forLogMessage(/Waiting for connections/))
    .start();
  return {
    uri: `mongodb://${container.getHost()}:${container.getMappedPort(27017)}/?directConnection=true`,
    stop: async () => {
      await container.stop();
    },
  };
}

export const uniqueDbName = (): string => `test_${randomUUID().replaceAll('-', '')}`;

// A host port with nothing listening on it (free at the time of the call).
export function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as net.AddressInfo;
      server.close(() => resolve(port));
    });
  });
}
