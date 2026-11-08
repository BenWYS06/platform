// Job: let a request through only with an X-Internal-Key equal to INTERNAL_API_KEY,
// compared in constant time. Otherwise 401 { "code": "UNAUTHENTICATED" }.
import { createHash, timingSafeEqual } from 'node:crypto';
import type { RequestHandler } from 'express';
import { send } from './errors.js';

const sha256 = (value: string): Buffer => createHash('sha256').update(value, 'utf8').digest();

export function requireInternalKey(key: string): RequestHandler {
  const expected = sha256(key);
  return (req, res, next) => {
    // Node joins a header sent twice into "a, b", which never equals the key.
    const sent = req.headers['x-internal-key'];
    // Hashing both sides gives equal lengths, so timingSafeEqual never throws or leaks length.
    if (typeof sent === 'string' && timingSafeEqual(sha256(sent), expected)) return next();
    send(res, 'UNAUTHENTICATED');
  };
}
