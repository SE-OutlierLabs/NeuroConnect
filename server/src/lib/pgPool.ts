import pg from 'pg';

// Single shared pool: used by the session store and by session invalidation.
// (pg.Pool connects lazily, so creating it at import time is safe.)
export const pgPool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});
