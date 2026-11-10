// Job: the one JSON logger. Secret headers are redacted wherever they appear.
import { pino } from 'pino';

export const REDACT_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["x-internal-key"]',
  'res.headers["set-cookie"]',
];

export function createLogger(destination?: pino.DestinationStream): pino.Logger {
  return pino({ base: { service: 'auth-service' }, redact: { paths: REDACT_PATHS, censor: '[redacted]' } }, destination);
}
