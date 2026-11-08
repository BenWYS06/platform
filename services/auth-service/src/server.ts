// Job: start auth-service: check config, then listen. Any startup failure exits with code 1.
import http from 'node:http';
import { createApp } from './app.js';
import { ConfigError, loadConfig } from './config.js';
import { createLogger } from './logger.js';

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

const app = createApp({ config, logger: log });
const server = http.createServer(app);
server.on('listening', () => log.info({ port: config.port, appEnv: config.appEnv }, 'auth-service listening'));
server.on('error', (e: NodeJS.ErrnoException) => {
  fail(e.code === 'EADDRINUSE' ? `port ${config.port} is already in use (AUTH_SERVICE_PORT)` : 'server failed to start');
});
server.listen(config.port);
