// Job: check that the local infra answers. Node only, no dependencies.
// Run: node infra/smoke.mjs   (prints one line per check; exits 1 if any check fails)
import net from 'node:net';
import http from 'node:http';

const HOST = '127.0.0.1';
const TIMEOUT_MS = 3000;

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
function get(port, path) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: HOST, port, path, method: 'GET', timeout: TIMEOUT_MS }, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => resolve({ status: res.statusCode, type: res.headers['content-type'] ?? '', body }));
    });
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', reject);
    req.end();
  });
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
];

let failed = 0;
for (const [name, run] of checks) {
  try {
    await run();
    console.log(`PASS ${name}`);
  } catch (err) {
    failed++;
    console.log(`FAIL ${name}: ${err.code ?? err.message}`);
  }
}
console.log(failed ? `${failed} of ${checks.length} checks failed` : `all ${checks.length} checks passed`);
process.exit(failed ? 1 : 0);
