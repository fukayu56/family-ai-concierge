/**
 * Vercel Serverless Function entry.
 * Rewrites send /health and /api/* here; Express routes keep their original paths
 * (/health, /api/spots, /api/recommendations) — no /api/api/* nesting.
 */
import app from '../server/src/app';

export default app;
