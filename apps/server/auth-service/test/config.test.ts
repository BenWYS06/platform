import { describe, expect, it } from 'vitest';
import { ConfigError, EXAMPLE_OWNER_EMAIL, LOCAL_DEFAULT_INTERNAL_KEY, LOCAL_WEB_ORIGIN, loadConfig } from '../src/config.js';

const GOOD_KEY = 'k'.repeat(32);
const PROD = {
  APP_ENV: 'prod',
  INTERNAL_API_KEY: GOOD_KEY,
  MONGODB_URI: 'mongodb://db/?replicaSet=rs0',
  REDIS_URL: 'redis://cache:6379',
  BOOTSTRAP_OWNER_EMAIL: 'boss@team.test',
  WEB_ORIGIN: 'https://example.com',
};

describe('loadConfig', () => {
  it('rejects an unknown APP_ENV', () => {
    expect(() => loadConfig({ APP_ENV: 'production' })).toThrow(/APP_ENV/);
  });

  it('rejects prod without an internal key', () => {
    expect(() => loadConfig({ ...PROD, INTERNAL_API_KEY: '' })).toThrow(ConfigError);
    expect(() => loadConfig({ ...PROD, INTERNAL_API_KEY: undefined })).toThrow(/INTERNAL_API_KEY/);
  });

  it('rejects prod with a short key without showing it', () => {
    let message = '';
    try {
      loadConfig({ ...PROD, INTERNAL_API_KEY: 'short-secret' });
    } catch (e) {
      message = (e as Error).message;
    }
    expect(message).toMatch(/INTERNAL_API_KEY/);
    expect(message).not.toContain('short-secret');
  });

  it('rejects prod with the local default key', () => {
    expect(() => loadConfig({ ...PROD, INTERNAL_API_KEY: LOCAL_DEFAULT_INTERNAL_KEY })).toThrow(/INTERNAL_API_KEY/);
  });

  it('rejects prod without store URLs', () => {
    expect(() => loadConfig({ ...PROD, MONGODB_URI: ' ' })).toThrow(/MONGODB_URI/);
    expect(() => loadConfig({ ...PROD, REDIS_URL: undefined })).toThrow(/REDIS_URL/);
  });

  it('accepts prod with safe values and no warning', () => {
    const warnings: string[] = [];
    const config = loadConfig(PROD, (m) => warnings.push(m));
    expect(config.internalApiKey).toBe(GOOD_KEY);
    expect(config.mongodbDb).toBe('platform');
    expect(warnings).toEqual([]);
  });

  it('uses the local default key with a warning outside prod', () => {
    const warnings: string[] = [];
    const config = loadConfig({ APP_ENV: 'local', INTERNAL_API_KEY: '' }, (m) => warnings.push(m));
    expect(config.internalApiKey).toBe(LOCAL_DEFAULT_INTERNAL_KEY);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatch(/INTERNAL_API_KEY/);
  });

  it('treats a missing APP_ENV as local with local store defaults', () => {
    const config = loadConfig({});
    expect(config.appEnv).toBe('local');
    expect(config.port).toBe(3001);
    expect(config.mongodbUri).toBe('mongodb://localhost:27017/?replicaSet=rs0');
    expect(config.redisUrl).toBe('redis://localhost:6379');
  });

  it('rejects a port that is not a number', () => {
    expect(() => loadConfig({ AUTH_SERVICE_PORT: 'abc' })).toThrow(/AUTH_SERVICE_PORT/);
  });
});

describe('loadConfig: first owner and client IP', () => {
  it('rejects prod without BOOTSTRAP_OWNER_EMAIL or with the example value, naming it', () => {
    expect(() => loadConfig({ ...PROD, BOOTSTRAP_OWNER_EMAIL: undefined })).toThrow(/BOOTSTRAP_OWNER_EMAIL/);
    expect(() => loadConfig({ ...PROD, BOOTSTRAP_OWNER_EMAIL: ' ' })).toThrow(/BOOTSTRAP_OWNER_EMAIL/);
    expect(() => loadConfig({ ...PROD, BOOTSTRAP_OWNER_EMAIL: EXAMPLE_OWNER_EMAIL })).toThrow(/BOOTSTRAP_OWNER_EMAIL/);
    expect(() => loadConfig({ ...PROD, BOOTSTRAP_OWNER_EMAIL: ' Owner@Example.COM ' })).toThrow(/BOOTSTRAP_OWNER_EMAIL/);
  });

  it('rejects prod without WEB_ORIGIN or with the example value, naming it', () => {
    expect(() => loadConfig({ ...PROD, WEB_ORIGIN: undefined })).toThrow(/WEB_ORIGIN/);
    expect(() => loadConfig({ ...PROD, WEB_ORIGIN: LOCAL_WEB_ORIGIN })).toThrow(/WEB_ORIGIN/);
  });

  it('stores the owner email trimmed and in lower case', () => {
    expect(loadConfig({ ...PROD, BOOTSTRAP_OWNER_EMAIL: '  Boss@Team.TEST ' }).bootstrapOwnerEmail).toBe('boss@team.test');
  });

  it('rejects an owner email that is not an email address', () => {
    expect(() => loadConfig({ BOOTSTRAP_OWNER_EMAIL: 'boss' })).toThrow(/BOOTSTRAP_OWNER_EMAIL/);
  });

  it('rejects a WEB_ORIGIN with a path or another scheme', () => {
    expect(() => loadConfig({ WEB_ORIGIN: 'https://example.com/app' })).toThrow(/WEB_ORIGIN/);
    expect(() => loadConfig({ WEB_ORIGIN: 'ftp://example.com' })).toThrow(/WEB_ORIGIN/);
    expect(() => loadConfig({ WEB_ORIGIN: 'not a url' })).toThrow(/WEB_ORIGIN/);
    expect(loadConfig({ WEB_ORIGIN: 'https://example.com/' }).webOrigin).toBe('https://example.com');
  });

  it('uses the local defaults: no owner email, web origin 5173, trust one proxy', () => {
    const config = loadConfig({});
    expect(config.bootstrapOwnerEmail).toBeUndefined();
    expect(config.webOrigin).toBe('http://localhost:5173');
    expect(config.trustProxy).toBe(1);
    expect(config.clientIpHeader).toBeUndefined();
  });

  it('trusts no proxy in prod unless TRUST_PROXY is set', () => {
    expect(loadConfig(PROD).trustProxy).toBe(false);
    expect(loadConfig({ ...PROD, TRUST_PROXY: '1' }).trustProxy).toBe(1);
    expect(loadConfig({ ...PROD, TRUST_PROXY: 'true' }).trustProxy).toBe(true);
    expect(loadConfig({ ...PROD, TRUST_PROXY: 'loopback, 10.0.0.0/8' }).trustProxy).toBe('loopback, 10.0.0.0/8');
  });

  it('reads CLIENT_IP_HEADER in lower case and rejects a bad name', () => {
    expect(loadConfig({ ...PROD, CLIENT_IP_HEADER: 'CF-Connecting-IP' }).clientIpHeader).toBe('cf-connecting-ip');
    expect(() => loadConfig({ CLIENT_IP_HEADER: 'bad header:' })).toThrow(/CLIENT_IP_HEADER/);
  });
});
