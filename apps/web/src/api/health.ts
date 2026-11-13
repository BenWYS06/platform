// Job: ask one service whether it is up: GET /api/<service>/health.
// 200 { "status": "UP" } is up. A running service with a store down answers 503
// { "status": "DOWN" } (D-010b); Caddy answers 503 { "code": "SERVICE_UNAVAILABLE" } when
// the service is not running. Both read as down with SERVICE_UNAVAILABLE.
import { getJson, NETWORK } from './http';

const SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE';

export const SERVICES = ['auth', 'chat', 'ai'] as const;
export type ServiceName = (typeof SERVICES)[number];

export type HealthResult = { status: 'UP' } | { status: 'DOWN'; code: string };

export async function checkHealth(service: ServiceName): Promise<HealthResult> {
  const result = await getJson<{ status?: unknown }>(`/${service}/health`);
  if (!result.ok) {
    const down = (result.body as { status?: unknown } | undefined)?.status === 'DOWN';
    return { status: 'DOWN', code: down ? SERVICE_UNAVAILABLE : result.code };
  }
  return result.data.status === 'UP' ? { status: 'UP' } : { status: 'DOWN', code: NETWORK };
}
