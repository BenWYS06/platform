// Job: check that the local infra answers. Node only, no dependencies.
// Run: node infra/docker-compose/smoke.mjs              (services may be up or down)
//      node infra/docker-compose/smoke.mjs --services   (every service must answer 200 UP)
// Prints one line per check; exits 1 if any check fails.
import net from 'node:net';
import http from 'node:http';

const HOST = '127.0.0.1';
const TIMEOUT_MS = 3000;
const REQUIRE_SERVICES = process.argv.includes('--services');
const SERVICES = ['auth', 'chat', 'ai'];
const LOCAL_INTERNAL_KEY = 'local-dev-internal-key-not-for-prod';

// Opens a TCP connection, optionally sends `send`, and resolves with what came back.
function tcp(port, send) {
  return new Promise((resolve, reject) => {
    const socket = net.connect({ host: HOST, port });
    let data = '';
    socket.setTimeout(TIMEOUT_MS, () => socket.destroy(new Error('timeout')));
    socket.on('connect', () => (send ? socket.write(send) : socket.end()));
    socket.on('data', (chunk) => {
      data += chunk;
      socket.end();
    });
    socket.on('error', reject);
    socket.on('close', () => resolve(data));
  });
}

// Sends a GET with the path exactly as given (no client-side normalization).
function get(port, path, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: HOST, port, path, headers, method: 'GET', timeout: TIMEOUT_MS }, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => resolve({ status: res.statusCode, type: res.headers['content-type'] ?? '', body }));
    });
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', reject);
    req.end();
  });
}

const CADDY_PORT = 8080;

// Paths with an /internal segment, including tricks a proxy or service might normalize.
const INTERNAL_PATHS = [
  '/internal/x',
  '/api/auth/internal/x',
  '/INTERNAL/x',
  '/api/auth/./internal/x',
  '/api/auth/%69nternal/x',
  '/api/auth//internal/x',
  '/api/auth/%2e/internal/x',
  '/api/auth%2Finternal/x',
  '/api/auth/internal;x/y',
  '/api/auth/internal%09',
];

// Caddy must answer with exactly { "code": code } as JSON.
async function expectCaddy(path, status, code, headers) {
  const res = await get(CADDY_PORT, path, headers);
  if (res.status !== status) throw new Error(`status ${res.status}, body ${res.body}`);
  if (!res.type.startsWith('application/json')) throw new Error(`content-type ${res.type}`);
  if (res.body !== JSON.stringify({ code })) throw new Error(`body ${res.body}`);
}

// A service health through Caddy: 200 UP when it runs with its stores; 503 DOWN when it
// runs and a store is down (D-010b); Caddy's 503 SERVICE_UNAVAILABLE when it is not running.
// Without --services all three pass; the returned note says which it was.
async function expectHealth(service) {
  const res = await get(CADDY_PORT, `/api/${service}/health`);
  const json = res.type.startsWith('application/json');
  if (res.status === 200 && json && res.body === JSON.stringify({ status: 'UP' })) return '200 UP';
  if (!REQUIRE_SERVICES && res.status === 503 && json) {
    if (res.body === JSON.stringify({ status: 'DOWN' })) return '503 DOWN (a store down)';
    if (res.body === JSON.stringify({ code: 'SERVICE_UNAVAILABLE' })) return '503 SERVICE_UNAVAILABLE (service not running)';
  }
  throw new Error(`status ${res.status}, body ${res.body}`);
}

const checks = [
  ['MongoDB answers on 27017', async () => tcp(27017)],
  ['Redis answers PING on 6379', async () => {
    const reply = await tcp(6379, 'PING\r\n');
    if (!reply.startsWith('+PONG')) throw new Error(`got ${JSON.stringify(reply)}`);
  }],
  ['RabbitMQ AMQP answers on 5672', async () => tcp(5672)],
  ['RabbitMQ management answers on 15672', async () => {
    const res = await get(15672, '/');
    if (res.status !== 200) throw new Error(`status ${res.status}`);
  }],
  ['Qdrant is ready on 6333', async () => {
    const res = await get(6333, '/readyz');
    if (res.status !== 200) throw new Error(`status ${res.status}`);
  }],
  ...SERVICES.map((service) => [
    `Caddy: /api/${service}/health -> ${REQUIRE_SERVICES ? '200 UP' : '200 UP or 503'}`,
    async () => expectHealth(service),
  ]),
  ...['/internal/ping', ...SERVICES.map((service) => `/api/${service}/internal/ping`)].map((path) => [
    `Caddy: ${path} with the local internal key -> 404 NOT_FOUND`,
    async () => expectCaddy(path, 404, 'NOT_FOUND', { 'X-Internal-Key': LOCAL_INTERNAL_KEY }),
  ]),
  ['Caddy: unknown path -> 404 NOT_FOUND', async () => expectCaddy('/no-such-path', 404, 'NOT_FOUND')],
  ...INTERNAL_PATHS.map((path) => [
    `Caddy: ${path} -> 404 NOT_FOUND`,
    async () => expectCaddy(path, 404, 'NOT_FOUND'),
  ]),
];

let failed = 0;
for (const [name, run] of checks) {
  try {
    const note = await run();
    console.log(`PASS ${name}${typeof note === 'string' && note ? `: ${note}` : ''}`);
  } catch (err) {
    failed++;
    console.log(`FAIL ${name}: ${err.code ?? err.message}`);
  }
}
console.log(failed ? `${failed} of ${checks.length} checks failed` : `all ${checks.length} checks passed`);
process.exit(failed ? 1 : 0);
