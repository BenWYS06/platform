// Job: what app.ts and server.ts use from health. Import health only through this file.
export { healthRouter } from './health.routes.js';
export { createHealth, type Health } from './health.service.js';
