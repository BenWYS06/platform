// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { checkHealth } from '../src/api/health';
import { getJson, NETWORK } from '../src/api/http';
import { fakeServer, json, stopFakeServer } from './fake-server';

afterEach(() => {
  stopFakeServer();
  vi.useRealTimers();
});

describe('api layer', () => {
  it('calls the relative /api base and returns the JSON body', async () => {
    const server = fakeServer(async () => json(200, { status: 'UP' }));
    expect(await checkHealth('auth')).toEqual({ status: 'UP' });
    expect(server.mock.calls[0]?.[0].url).toBe('/api/auth/health');
  });

  it('returns the contract code of an error answer', async () => {
    fakeServer(async () => json(503, { code: 'SERVICE_UNAVAILABLE' }));
    expect(await checkHealth('chat')).toEqual({ status: 'DOWN', code: 'SERVICE_UNAVAILABLE' });
  });

  it('reads a 503 { status: DOWN } health answer as SERVICE_UNAVAILABLE', async () => {
    fakeServer(async () => json(503, { status: 'DOWN' }));
    expect(await checkHealth('auth')).toEqual({ status: 'DOWN', code: 'SERVICE_UNAVAILABLE' });
  });

  it('keeps a JSON error body without a contract code, with code NETWORK', async () => {
    fakeServer(async () => json(500, { status: 'DOWN' }));
    expect(await getJson('/x')).toEqual({ ok: false, code: NETWORK, body: { status: 'DOWN' } });
  });

  it('passes an unknown code through for the screen to map', async () => {
    fakeServer(async () => json(418, { code: 'TEAPOT_BUSY', message: 'raw server text' }));
    expect(await getJson('/x')).toEqual({ ok: false, code: 'TEAPOT_BUSY' });
  });

  it('gives NETWORK after 5 s without an answer', async () => {
    vi.useFakeTimers();
    fakeServer(() => new Promise(() => {}));
    const pending = checkHealth('ai');
    await vi.advanceTimersByTimeAsync(4999);
    let settled = false;
    void pending.then(() => (settled = true));
    await Promise.resolve();
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(await pending).toEqual({ status: 'DOWN', code: NETWORK });
  });

  it('gives NETWORK for an HTML answer, never its text', async () => {
    fakeServer(async () => ({ status: 502, body: '<html>Bad Gateway</html>', contentType: 'text/html' }));
    expect(await getJson('/x')).toEqual({ ok: false, code: NETWORK });
  });

  it('gives NETWORK for an empty or broken JSON body', async () => {
    fakeServer(async () => ({ status: 200, body: '' }));
    expect(await getJson('/x')).toEqual({ ok: false, code: NETWORK });
    fakeServer(async () => ({ status: 500, body: '{"code":' }));
    expect(await getJson('/x')).toEqual({ ok: false, code: NETWORK });
  });

  it('gives NETWORK when the server cannot be reached', async () => {
    fakeServer(async () => {
      throw new TypeError('Failed to fetch');
    });
    expect(await checkHealth('auth')).toEqual({ status: 'DOWN', code: NETWORK });
  });

  it('treats a 200 without status UP as not up', async () => {
    fakeServer(async () => json(200, { status: 'MAYBE' }));
    expect(await checkHealth('auth')).toEqual({ status: 'DOWN', code: NETWORK });
  });
});
