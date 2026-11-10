// Job: the only way the web app talks to the server. Relative /api base, 5 s timeout.
// A result is either the JSON body or an error code: a contract code from the server, or
// NETWORK when there is no usable answer (no connection, timeout, HTML, empty body).

export const NETWORK = 'NETWORK';

const BASE_URL = '/api';
const TIMEOUT_MS = 5000;
const CONTRACT_CODE = /^[A-Z][A-Z0-9_]*$/;

export type ApiResult<T> = { ok: true; data: T } | { ok: false; code: string };

export async function getJson<T>(path: string): Promise<ApiResult<T>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(`${BASE_URL}${path}`, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    const body = await readJson(response);
    if (response.ok) {
      return body === undefined ? { ok: false, code: NETWORK } : { ok: true, data: body as T };
    }
    return { ok: false, code: errorCode(body) ?? NETWORK };
  } catch {
    return { ok: false, code: NETWORK };
  } finally {
    clearTimeout(timer);
  }
}

// The parsed body, or undefined when the answer is not JSON.
async function readJson(response: Response): Promise<unknown> {
  if (!response.headers.get('content-type')?.includes('application/json')) return undefined;
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}

// The `code` of a contract error body `{ code, message? }`; the message is never used.
function errorCode(body: unknown): string | undefined {
  if (typeof body !== 'object' || body === null) return undefined;
  const code = (body as { code?: unknown }).code;
  return typeof code === 'string' && CONTRACT_CODE.test(code) ? code : undefined;
}
