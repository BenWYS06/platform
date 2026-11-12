// Job: the only way the web app talks to the server. Relative /api base, 5 s timeout.
// A result is either the JSON body or an error code: a contract code from the server, or
// NETWORK when there is no usable answer (no connection, timeout, HTML, empty body).
import axios, { type AxiosResponse } from 'axios';

export const NETWORK = 'NETWORK';

const CONTRACT_CODE = /^[A-Z][A-Z0-9_]*$/;

export type ApiResult<T> = { ok: true; data: T } | { ok: false; code: string };

// The one axios instance. Exported so tests can set a fake adapter on it.
export const apiClient = axios.create({
  baseURL: '/api',
  timeout: 5000,
  headers: { Accept: 'application/json' },
  responseType: 'json',
  // Broken JSON throws instead of coming back as a string.
  transitional: { silentJSONParsing: false },
  // Every status resolves, so the contract error body can be read.
  validateStatus: () => true,
});

export async function getJson<T>(path: string): Promise<ApiResult<T>> {
  try {
    const response = await apiClient.get<unknown>(path);
    const body = jsonBody(response);
    if (response.status >= 200 && response.status < 300) {
      return body === undefined ? { ok: false, code: NETWORK } : { ok: true, data: body as T };
    }
    return { ok: false, code: errorCode(body) ?? NETWORK };
  } catch {
    return { ok: false, code: NETWORK };
  }
}

// The parsed body, or undefined when the answer is not JSON or is empty.
function jsonBody(response: AxiosResponse<unknown>): unknown {
  const type = String(response.headers['content-type'] ?? '');
  if (!type.includes('application/json')) return undefined;
  return response.data === '' || response.data === null ? undefined : response.data;
}

// The `code` of a contract error body `{ code, message? }`; the message is never used.
function errorCode(body: unknown): string | undefined {
  if (typeof body !== 'object' || body === null) return undefined;
  const code = (body as { code?: unknown }).code;
  return typeof code === 'string' && CONTRACT_CODE.test(code) ? code : undefined;
}
