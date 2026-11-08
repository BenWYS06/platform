import { describe, expect, it } from 'vitest';
import { ConfigError, LOCAL_DEFAULT_INTERNAL_KEY, loadConfig } from '../src/config.js';

const GOOD_KEY = 'k'.repeat(32);
const PROD = { APP_ENV: 'prod', INTERNAL_API_KEY: GOOD_KEY, MONGODB_URI: 'mongodb://db/?replicaSet=rs0', REDIS_URL: 'redis://cache:6379' };

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
    expect(config.mongodbDb).toBe('openbox_auth');
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
