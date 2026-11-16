import { Request, Response, NextFunction } from 'express';
import { Role } from '@prisma/client';
import { prisma } from '../lib/prisma.js';

declare module 'express-session' {
  interface SessionData {
    userId: number;
    role: Role;
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const user = await prisma.user.findUnique({
    where: { user_id: req.session.userId },
    select: { user_id: true, role: true, account_status: true, email_verified: true },
  });

  if (!user || user.account_status !== 'active') {
    req.session.destroy(() => {});
    return res.status(403).json({ error: 'Account is suspended or deactivated' });
  }

  (req as any).currentUser = user;
  next();
}

export function requireVerifiedEmail(req: Request, res: Response, next: NextFunction) {
  const user = (req as any).currentUser;
  if (!user?.email_verified) {
    return res.status(403).json({ error: 'Please verify your email address first' });
  }
  next();
}

export function requireRoles(...allowedRoles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).currentUser;
    if (!user || !allowedRoles.includes(user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}