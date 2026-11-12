// Job: a fake server for tests. Puts a fake adapter on the api client, so no test talks to
// the network and no test imports axios. Like a real adapter, it applies the request
// timeout and validateStatus.
import { vi } from 'vitest';
import { apiClient } from '../src/api/http';

export type FakeRequest = { url: string };
export type FakeAnswer = { status: number; body: string; contentType?: string };

const realAdapter = apiClient.defaults.adapter;

export const json = (status: number, body: unknown): FakeAnswer => ({ status, body: JSON.stringify(body) });

// answer gets each request; it returns the answer, throws (no answer), or never settles.
export function fakeServer(answer: (request: FakeRequest) => Promise<FakeAnswer>) {
  const calls = vi.fn(answer);
  apiClient.defaults.adapter = async (config) => {
    const reply = calls({ url: `${config.baseURL ?? ''}${config.url ?? ''}` });
    const timeout = new Promise<never>((_resolve, reject) => {
      if (config.timeout) setTimeout(() => reject(new Error('timeout')), config.timeout);
    });
    const { status, body, contentType } = await Promise.race([reply, timeout]);
    if (config.validateStatus && !config.validateStatus(status)) throw new Error(`status ${status}`);
    return {
      data: body,
      status,
      statusText: '',
      headers: { 'content-type': contentType ?? 'application/json' },
      config,
    };
  };
  return calls;
}

export function stopFakeServer() {
  apiClient.defaults.adapter = realAdapter;
}
