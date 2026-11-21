import { Request, Response, NextFunction } from 'express';
import { Role } from '@prisma/client';
import { prisma } from '../lib/prisma.js';

// Tell TypeScript which values we store in the session.
declare module 'express-session' {
  interface SessionData {
    userId: number;
    role: Role;
  }
}

// Blocks the request unless the user is logged in and their account is still active.
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  // Reload the user on every request so a suspended account loses access immediately.
  const user = await prisma.user.findUnique({
    where: { user_id: req.session.userId },
    select: { user_id: true, role: true, account_status: true, email_verified: true },
  });

  if (!user || user.account_status !== 'active') {
    req.session.destroy(() => {});
    return res.status(403).json({ error: 'Account is suspended or deactivated' });
  }

  // Make the user available to later middleware and route handlers.
  (req as any).currentUser = user;
  next();
}

// Blocks users who have not verified their email with the OTP code (use after requireAuth).
export function requireVerifiedEmail(req: Request, res: Response, next: NextFunction) {
  const user = (req as any).currentUser;
  if (!user?.email_verified) {
    return res.status(403).json({ error: 'Please verify your email address first' });
  }
  next();
}

// Allows only the listed roles, e.g. requireRoles('admin') (use after requireAuth).
export function requireRoles(...allowedRoles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).currentUser;
    if (!user || !allowedRoles.includes(user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}