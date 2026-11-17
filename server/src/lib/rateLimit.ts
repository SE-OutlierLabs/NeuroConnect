import { rateLimit } from 'express-rate-limit';

function limiter(opts: { windowMs: number; limit: number; message: string; skipSuccessfulRequests?: boolean }) {
  return rateLimit({
    windowMs: opts.windowMs,
    limit: opts.limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    skipSuccessfulRequests: opts.skipSuccessfulRequests ?? false,
    message: { error: opts.message },
  });
}

const FIFTEEN_MIN = 15 * 60 * 1000;

// Login: only failed attempts count towards the limit.
export const loginLimiter = limiter({
  windowMs: FIFTEEN_MIN,
  limit: 10,
  skipSuccessfulRequests: true,
  message: 'Too many login attempts. Please wait 15 minutes and try again.',
});

// Registration, OTP verification, resend, forgot/reset password.
export const authLimiter = limiter({
  windowMs: FIFTEEN_MIN,
  limit: 20,
  message: 'Too many requests. Please wait a few minutes and try again.',
});
