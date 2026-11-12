// Job: start auth-service: check config, open store clients, then listen.
// Any startup failure exits with code 1. Stores may be down at startup; health reports it.
import http from 'node:http';
import { createApp } from './app.js';
import { ConfigError, loadConfig } from './config.js';
import { createLogger } from './logger.js';
import { createInvitationsRepository } from './repositories/invitations.js';
import { createStores } from './repositories/stores.js';
import { createUsersRepository } from './repositories/users.js';
import { createHealth } from './services/health.js';
import { createStartupLoop } from './services/startup.js';

const log = createLogger();

function fail(message: string): never {
  log.fatal(message);
  process.exit(1);
}

let config;
try {
  config = loadConfig(undefined, (message) => log.warn(message));
} catch (e) {
  fail(e instanceof ConfigError ? e.message : 'config could not be read');
}

const stores = createStores(config);
const health = createHealth(
  [
    { name: 'mongodb', check: stores.pingMongo },
    { name: 'redis', check: stores.pingRedis },
  ],
  log,
);

const users = createUsersRepository(stores.connection);
const invitations = createInvitationsRepository(stores.connection);
const startup = createStartupLoop(
  {
    async ensureIndexes() {
      await stores.connectMongo();
      await users.ensureIndexes();
      await invitations.ensureIndexes();
    },
  },
  log,
);

const app = createApp({ config, logger: log, health, readiness: startup });
const server = http.createServer(app);
server.on('listening', () => log.info({ port: config.port, appEnv: config.appEnv }, 'auth-service listening'));
server.on('error', (e: NodeJS.ErrnoException) => {
  fail(e.code === 'EADDRINUSE' ? `port ${config.port} is already in use (AUTH_SERVICE_PORT)` : 'server failed to start');
});
server.listen(config.port);
startup.start();

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    log.info({ signal }, 'shutting down');
    startup.stop();
    server.close();
    void stores.close().finally(() => process.exit(0));
  });
}
