// Job: the client IP for limits (spec 009 A8). CLIENT_IP_HEADER (for example cf-connecting-ip)
// decides when set and it holds a valid IP; otherwise Express `req.ip`, which follows
// `trust proxy` (TRUST_PROXY). See docs/environments.md before setting either.
import { isIP } from 'node:net';
import type { Request } from 'express';

export function clientIp(req: Request, header: string | undefined): string {
  if (header) {
    const value = req.headers[header];
    if (typeof value === 'string' && isIP(value.trim())) return value.trim();
  }
  return req.ip ?? req.socket.remoteAddress ?? 'unknown';
}
