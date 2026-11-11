// Job: read and check env once at startup. The only file that reads process.env.
// Errors and warnings name the variable, never its value.
import { z } from 'zod';

export const LOCAL_DEFAULT_INTERNAL_KEY = 'local-dev-internal-key-not-for-prod';
export const MIN_PROD_KEY_LENGTH = 32;
const LOCAL_MONGODB_URI = 'mongodb://localhost:27017/?replicaSet=rs0';
const LOCAL_REDIS_URL = 'redis://localhost:6379';

export type AppEnv = 'local' | 'dev' | 'prod';

export interface Config {
  appEnv: AppEnv;
  port: number;
  internalApiKey: string;
  mongodbUri: string;
  mongodbDb: string;
  redisUrl: string;
}

export class ConfigError extends Error {}

// Blank values count as not set, so `NAME=` in .env behaves like a missing line.
const optional = z.preprocess((v) => (typeof v === 'string' && v.trim() === '' ? undefined : v), z.string().optional());

const schema = z.object({
  APP_ENV: z.preprocess((v) => (v === '' ? undefined : v), z.enum(['local', 'dev', 'prod']).default('local')),
  AUTH_SERVICE_PORT: z.preprocess(
    (v) => (v === '' || v === undefined ? undefined : Number(v)),
    z.number().int().min(1).max(65535).default(3001),
  ),
  INTERNAL_API_KEY: optional,
  MONGODB_URI: optional,
  REDIS_URL: optional,
});

export function loadConfig(env: NodeJS.ProcessEnv = process.env, warn: (message: string) => void = () => {}): Config {
  const parsed = schema.safeParse(env);
  if (!parsed.success) {
    const names = [...new Set(parsed.error.issues.map((i) => String(i.path[0])))];
    throw new ConfigError(`${names.join(', ')} invalid (APP_ENV must be local, dev or prod)`);
  }
  const { APP_ENV, AUTH_SERVICE_PORT, INTERNAL_API_KEY, MONGODB_URI, REDIS_URL } = parsed.data;

  if (APP_ENV === 'prod') {
    if (!INTERNAL_API_KEY || INTERNAL_API_KEY.length < MIN_PROD_KEY_LENGTH || INTERNAL_API_KEY === LOCAL_DEFAULT_INTERNAL_KEY) {
      throw new ConfigError('INTERNAL_API_KEY is missing, shorter than 32 characters or the local default (APP_ENV=prod)');
    }
    if (!MONGODB_URI) throw new ConfigError('MONGODB_URI is missing (APP_ENV=prod)');
    if (!REDIS_URL) throw new ConfigError('REDIS_URL is missing (APP_ENV=prod)');
  }

  let internalApiKey = INTERNAL_API_KEY;
  if (!internalApiKey) {
    warn('INTERNAL_API_KEY is not set; using the local default (not allowed in prod)');
    internalApiKey = LOCAL_DEFAULT_INTERNAL_KEY;
  }

  return {
    appEnv: APP_ENV,
    port: AUTH_SERVICE_PORT,
    internalApiKey,
    mongodbUri: MONGODB_URI ?? LOCAL_MONGODB_URI,
    mongodbDb: 'platform',
    redisUrl: REDIS_URL ?? LOCAL_REDIS_URL,
  };
}
