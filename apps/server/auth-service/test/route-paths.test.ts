// Every route of the built app lives under /api/auth or /internal (spec 012 A7, Done when 10).
// Express 5 layers do not keep their mount path, so the test records app.use paths while the
// app is built, then walks each mounted router's stack for its routes.
import { Writable } from 'node:stream';
import express, { type Express, Router } from 'express';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app.js';
import { createLogger } from '../src/logger.js';
import type { LogoutService } from '../src/services/logout.js';
import type { RefreshService } from '../src/services/refresh.js';
import type { SessionService } from '../src/services/session.js';
import { noLimit, unusedInvitations, unusedLogin } from './helpers/invitations.js';

const ALLOWED = ['/api/auth/', '/internal/'];
const unusedSession = {} as SessionService;
const unusedRefresh = {} as RefreshService;
const unusedLogout = {} as LogoutService;

interface Layer {
  route?: { path: string; methods: Record<string, boolean> };
  handle: { stack?: Layer[] };
}

function routesOf(stack: Layer[], prefix: string): string[] {
  return stack
    .filter((layer) => layer.route)
    .map((layer) => `${Object.keys(layer.route?.methods ?? {}).join(',').toUpperCase()} ${prefix}${layer.route?.path}`);
}

// Builds the app with `mount` run on it last, and lists every route with its full path.
function listRoutes(mount: (app: Express) => void = () => {}): string[] {
  const mounts: { prefix: string; handlers: unknown[] }[] = [];
  const use = express.application.use;
  vi.spyOn(express.application, 'use').mockImplementation(function (this: Express, ...args: unknown[]) {
    const [first, ...rest] = args;
    const pathGiven = typeof first === 'string' || Array.isArray(first);
    const prefixes = pathGiven ? ([] as string[]).concat(first as string | string[]) : [''];
    for (const prefix of prefixes) mounts.push({ prefix, handlers: (pathGiven ? rest : args).flat() });
    return use.apply(this, args as Parameters<typeof use>);
  });
  const app = createApp({
    config: { internalApiKey: 'k' },
    logger: createLogger(new Writable({ write: (_c, _e, done) => done() })),
    health: { allUp: async () => true },
    readiness: { isReady: () => true },
    invitations: unusedInvitations,
    acceptLimit: noLimit,
    login: unusedLogin,
    session: unusedSession,
    refresh: unusedRefresh,
    logout: unusedLogout,
  });
  mount(app);
  const nested = mounts.flatMap(({ prefix, handlers }) =>
    handlers.flatMap((h) => routesOf((h as Layer['handle']).stack ?? [], prefix)),
  );
  return [...routesOf((app as unknown as { router: { stack: Layer[] } }).router.stack, ''), ...nested];
}

const outside = (routes: string[]) => routes.filter((r) => !ALLOWED.some((p) => r.split(' ')[1]?.startsWith(p)));

afterEach(() => vi.restoreAllMocks());

describe('route paths', () => {
  it('mounts every route under /api/auth or /internal, and names a route outside them', () => {
    const routes = listRoutes();
    expect(routes).toEqual(
      expect.arrayContaining(['POST /api/auth/login', 'POST /api/auth/refresh', 'POST /api/auth/logout', 'GET /api/auth/session', 'GET /api/auth/me', 'GET /api/auth/health', 'GET /internal/ping']),
    );
    expect(outside(routes)).toEqual([]);

    vi.restoreAllMocks();
    const other = Router();
    other.get('/ping', (_req, res) => void res.json({}));
    expect(outside(listRoutes((app) => app.use('/api/other', other)))).toEqual(['GET /api/other/ping']);
  });
});
