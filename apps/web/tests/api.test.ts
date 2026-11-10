// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { checkHealth } from '../src/api/health';
import { getJson, NETWORK } from '../src/api/http';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

function stubFetch(answer: (url: string, init: RequestInit) => Promise<Response>) {
  const fetchMock = vi.fn(answer);
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('api layer', () => {
  it('calls the relative /api base and returns the JSON body', async () => {
    const fetchMock = stubFetch(async () => json(200, { status: 'UP' }));
    expect(await checkHealth('auth')).toEqual({ status: 'UP' });
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/auth/health');
  });

  it('returns the contract code of an error answer', async () => {
    stubFetch(async () => json(503, { code: 'SERVICE_UNAVAILABLE' }));
    expect(await checkHealth('chat')).toEqual({ status: 'DOWN', code: 'SERVICE_UNAVAILABLE' });
  });

  it('passes an unknown code through for the screen to map', async () => {
    stubFetch(async () => json(418, { code: 'TEAPOT_BUSY', message: 'raw server text' }));
    expect(await getJson('/x')).toEqual({ ok: false, code: 'TEAPOT_BUSY' });
  });

  it('gives NETWORK after 5 s without an answer', async () => {
    vi.useFakeTimers();
    stubFetch(
      (_url, init) =>
        new Promise((_resolve, reject) =>
          init.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError'))),
        ),
    );
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
    stubFetch(async () => new Response('<html>Bad Gateway</html>', { status: 502, headers: { 'Content-Type': 'text/html' } }));
    expect(await getJson('/x')).toEqual({ ok: false, code: NETWORK });
  });

  it('gives NETWORK for an empty or broken JSON body', async () => {
    stubFetch(async () => new Response('', { status: 200, headers: { 'Content-Type': 'application/json' } }));
    expect(await getJson('/x')).toEqual({ ok: false, code: NETWORK });
    stubFetch(async () => new Response('{"code":', { status: 500, headers: { 'Content-Type': 'application/json' } }));
    expect(await getJson('/x')).toEqual({ ok: false, code: NETWORK });
  });

  it('gives NETWORK when the server cannot be reached', async () => {
    stubFetch(async () => {
      throw new TypeError('Failed to fetch');
    });
    expect(await checkHealth('auth')).toEqual({ status: 'DOWN', code: NETWORK });
  });

  it('treats a 200 without status UP as not up', async () => {
    stubFetch(async () => json(200, { status: 'MAYBE' }));
    expect(await checkHealth('auth')).toEqual({ status: 'DOWN', code: NETWORK });
  });
});
