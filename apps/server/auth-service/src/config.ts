// Job: read and check env once at startup. The only file that reads process.env.
// Errors and warnings name the variable, never its value.
import { z } from 'zod';

export const LOCAL_DEFAULT_INTERNAL_KEY = 'local-dev-internal-key-not-for-prod';
export const MIN_PROD_KEY_LENGTH = 32;
const LOCAL_MONGODB_URI = 'mongodb://localhost:27017/?replicaSet=rs0';
const LOCAL_REDIS_URL = 'redis://localhost:6379';
// The values .env.example shows; prod refuses them.
export const EXAMPLE_OWNER_EMAIL = 'owner@example.com';
export const LOCAL_WEB_ORIGIN = 'http://localhost:5173';
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const HEADER_NAME = /^[a-z0-9-]+$/;

export type AppEnv = 'local' | 'dev' | 'prod';

export interface Config {
  appEnv: AppEnv;
  port: number;
  internalApiKey: string;
  mongodbUri: string;
  mongodbDb: string;
  redisUrl: string;
  // Trimmed and lower case; undefined skips the first-owner boot step.
  bootstrapOwnerEmail: string | undefined;
  // Origin of the web client, used in links (for example the boot link).
  webOrigin: string;
  // Express `trust proxy`: false, a hop count, or a list of addresses.
  trustProxy: boolean | number | string;
  // Lower-case header that carries the client IP (for example cf-connecting-ip), or undefined.
  clientIpHeader: string | undefined;
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
  BOOTSTRAP_OWNER_EMAIL: optional,
  WEB_ORIGIN: optional,
  TRUST_PROXY: optional,
  CLIENT_IP_HEADER: optional,
});

export function loadConfig(env: NodeJS.ProcessEnv = process.env, warn: (message: string) => void = () => {}): Config {
  const parsed = schema.safeParse(env);
  if (!parsed.success) {
    const names = [...new Set(parsed.error.issues.map((i) => String(i.path[0])))];
    throw new ConfigError(`${names.join(', ')} invalid (APP_ENV must be local, dev or prod)`);
  }
  const { APP_ENV, AUTH_SERVICE_PORT, INTERNAL_API_KEY, MONGODB_URI, REDIS_URL } = parsed.data;
  const bootstrapOwnerEmail = ownerEmail(parsed.data.BOOTSTRAP_OWNER_EMAIL);
  const webOrigin = origin(parsed.data.WEB_ORIGIN);
  const clientIpHeader = headerName(parsed.data.CLIENT_IP_HEADER);

  if (APP_ENV === 'prod') {
    if (!INTERNAL_API_KEY || INTERNAL_API_KEY.length < MIN_PROD_KEY_LENGTH || INTERNAL_API_KEY === LOCAL_DEFAULT_INTERNAL_KEY) {
      throw new ConfigError('INTERNAL_API_KEY is missing, shorter than 32 characters or the local default (APP_ENV=prod)');
    }
    if (!MONGODB_URI) throw new ConfigError('MONGODB_URI is missing (APP_ENV=prod)');
    if (!REDIS_URL) throw new ConfigError('REDIS_URL is missing (APP_ENV=prod)');
    if (!bootstrapOwnerEmail || bootstrapOwnerEmail === EXAMPLE_OWNER_EMAIL) {
      throw new ConfigError('BOOTSTRAP_OWNER_EMAIL is missing or the example value (APP_ENV=prod)');
    }
    if (!webOrigin || webOrigin === LOCAL_WEB_ORIGIN) {
      throw new ConfigError('WEB_ORIGIN is missing or the local example value (APP_ENV=prod)');
    }
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
    bootstrapOwnerEmail,
    webOrigin: webOrigin ?? LOCAL_WEB_ORIGIN,
    trustProxy: trustProxy(parsed.data.TRUST_PROXY, APP_ENV),
    clientIpHeader,
  };
}

function ownerEmail(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const email = value.trim().toLowerCase();
  if (!EMAIL.test(email)) throw new ConfigError('BOOTSTRAP_OWNER_EMAIL is not an email address');
  return email;
}

// Only scheme, host and port: links are built as <origin>/path.
function origin(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new ConfigError('WEB_ORIGIN is not a URL');
  }
  if (!['http:', 'https:'].includes(url.protocol) || url.origin !== value.trim().replace(/\/$/, '')) {
    throw new ConfigError('WEB_ORIGIN must be an http(s) origin with no path, for example http://localhost:5173');
  }
  return url.origin;
}

// Unset: 1 hop locally (Caddy), none elsewhere. "true"/"false", a hop count, or addresses.
function trustProxy(value: string | undefined, appEnv: AppEnv): boolean | number | string {
  if (value === undefined) return appEnv === 'local' ? 1 : false;
  const v = value.trim();
  if (v === 'true') return true;
  if (v === 'false') return false;
  if (/^\d+$/.test(v)) return Number(v);
  return v;
}

function headerName(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const name = value.trim().toLowerCase();
  if (!HEADER_NAME.test(name)) throw new ConfigError('CLIENT_IP_HEADER is not a header name');
  return name;
}
