// Job: ask one service whether it is up: GET /api/<service>/health.
import { getJson, NETWORK } from './http';

export const SERVICES = ['auth', 'chat', 'ai'] as const;
export type ServiceName = (typeof SERVICES)[number];

export type HealthResult = { status: 'UP' } | { status: 'DOWN'; code: string };

export async function checkHealth(service: ServiceName): Promise<HealthResult> {
  const result = await getJson<{ status?: unknown }>(`/${service}/health`);
  if (!result.ok) return { status: 'DOWN', code: result.code };
  return result.data.status === 'UP' ? { status: 'UP' } : { status: 'DOWN', code: NETWORK };
}
