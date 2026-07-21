/**
 * Local / traditional server entry.
 * Vercel imports the Express app from ./app (or via /api/index.ts) and must not call listen.
 */
import app from './app';

const PORT = Number.parseInt(process.env.PORT ?? '3001', 10) || 3001;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Family AI Concierge API listening on port ${PORT}`);
});
