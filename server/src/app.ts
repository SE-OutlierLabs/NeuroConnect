import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import session from 'express-session';
import pgSession from 'connect-pg-simple';
import { prisma } from './lib/prisma.js';
import { pgPool } from './lib/pgPool.js';
import authRoutes from './routes/auth.routes.js';
import adminRoutes from './routes/admin.routes.js';
import mentorRoutes from './routes/mentor.routes.js';

const isProd = process.env.NODE_ENV === 'production';

export function createApp(opts: { store?: session.Store } = {}) {
  if (isProd && !process.env.SESSION_SECRET) {
    throw new Error('SESSION_SECRET must be set in production');
  }

  const app = express();
  app.disable('x-powered-by');

  // Behind Railway/Vercel/any reverse proxy, Express must trust the proxy,
  // otherwise "secure" cookies are never set and rate limiting sees the proxy IP.
  const trustProxy = process.env.TRUST_PROXY ?? (isProd ? '1' : '');
  if (trustProxy) app.set('trust proxy', Number.isNaN(Number(trustProxy)) ? trustProxy : Number(trustProxy));

  // 'lax' works when client and API share a site. If the client (Vercel) and the
  // API (Railway) are on different sites, set COOKIE_SAMESITE=none (forces secure).
  const sameSite = (process.env.COOKIE_SAMESITE as 'lax' | 'strict' | 'none' | undefined) ?? 'lax';

  const PgStore = pgSession(session);

  app.use(
    cors({
      origin: process.env.CLIENT_URL || 'http://localhost:5173',
      credentials: true,
    })
  );
  app.use(express.json({ limit: '100kb' }));

  app.use(
    session({
      store: opts.store ?? new PgStore({ pool: pgPool, createTableIfMissing: true }),
      secret: process.env.SESSION_SECRET || 'dev-secret-change-me',
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        secure: isProd || sameSite === 'none',
        sameSite,
        maxAge: 1000 * 60 * 60 * 24 * 7,
      },
    })
  );

  // Health check
  app.get('/api/health', async (_req, res) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      res.json({ status: 'ok', database: 'connected' });
    } catch {
      res.status(500).json({ status: 'error', database: 'disconnected' });
    }
  });

  // Sprint 1 Routes
  app.use('/api/auth', authRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/mentors', mentorRoutes);

  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  // Global error handler (Express 5 forwards rejected async handlers here).
  // Never leak stack traces or internals to the client.
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    if (err?.type === 'entity.parse.failed') {
      return res.status(400).json({ error: 'Request body is not valid JSON' });
    }
    if (err?.type === 'entity.too.large') {
      return res.status(413).json({ error: 'Request body is too large' });
    }
    console.error('[unhandled error]', err);
    res.status(500).json({ error: 'Something went wrong on our side. Please try again.' });
  });

  return app;
}
