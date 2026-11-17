import { Router, Request } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { createAndSendOtp, verifyOtp } from '../lib/mailer.js';
import { invalidateUserSessions } from '../lib/sessions.js';
import { authLimiter, loginLimiter } from '../lib/rateLimit.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// bcrypt only uses the first 72 BYTES of a password, so reject anything longer
// instead of silently truncating it.
const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .refine((p) => Buffer.byteLength(p, 'utf8') <= 72, 'Password must be at most 72 characters');

const emailSchema = z.string().email().toLowerCase();
const otpCodeSchema = z.string().regex(/^\d{6}$/, 'Code must be 6 digits');

const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  display_name: z.string().trim().min(2).max(50),
  role: z.enum(['mentee', 'mentor']).default('mentee'),
  // FR1.1 / DR3: only adults (18+) may register.
  age_confirmed: z.literal(true, { error: 'You must confirm that you are 18 or older' }),
});

const verifyOtpSchema = z.object({ email: emailSchema, code: otpCodeSchema });
const loginSchema = z.object({ email: emailSchema, password: z.string().min(1) });
const resetPasswordSchema = z.object({
  email: emailSchema,
  code: otpCodeSchema,
  new_password: passwordSchema,
});

// Used so a login for an unknown email takes as long as one for a real email
// (prevents account enumeration through response timing).
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 12);

const publicUserSelect = {
  user_id: true,
  email: true,
  display_name: true,
  role: true,
  email_verified: true,
} as const;

/** Starts a fresh session for the user (regenerating the id prevents session fixation). */
function establishSession(req: Request, userId: number, role: Prisma.UserGetPayload<{}>['role']) {
  return new Promise<void>((resolve, reject) => {
    req.session.regenerate((err) => {
      if (err) return reject(err);
      req.session.userId = userId;
      req.session.role = role;
      req.session.save((saveErr) => (saveErr ? reject(saveErr) : resolve()));
    });
  });
}

// POST /api/auth/register
router.post('/register', authLimiter, async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { email, password, display_name, role } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return res.status(409).json({ error: 'Email is already registered' });

  const password_hash = await bcrypt.hash(password, 12);

  let user;
  try {
    user = await prisma.user.create({
      data: { email, password_hash, display_name, role },
      select: publicUserSelect,
    });
  } catch (err) {
    // Two simultaneous registrations for the same email: the DB unique index wins.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return res.status(409).json({ error: 'Email is already registered' });
    }
    throw err;
  }

  const otpSent = await createAndSendOtp(user.user_id, user.email, 'verify_email');

  res.status(201).json({
    message: otpSent
      ? 'Account created. Please verify the 6-digit OTP sent to your email.'
      : 'Account created, but we could not send the OTP. Please request a new code.',
    otp_sent: otpSent,
    user,
  });
});

// POST /api/auth/verify-otp
router.post('/verify-otp', authLimiter, async (req, res) => {
  const parsed = verifyOtpSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { email, code } = parsed.data;
  const user = await prisma.user.findUnique({ where: { email } });

  // One generic answer for every failure so this endpoint can't be used to probe accounts.
  const invalid = () => res.status(400).json({ error: 'Invalid or expired OTP' });
  if (!user || user.account_status !== 'active' || user.email_verified) return invalid();

  const valid = await verifyOtp(user.user_id, code, 'verify_email');
  if (!valid) return invalid();

  const updated = await prisma.user.update({
    where: { user_id: user.user_id },
    data: { email_verified: true },
    select: publicUserSelect,
  });

  await establishSession(req, updated.user_id, updated.role);

  res.json({ message: 'Email verified successfully', user: updated });
});

// POST /api/auth/resend-otp
router.post('/resend-otp', authLimiter, async (req, res) => {
  const email = emailSchema.safeParse(req.body?.email);
  if (!email.success) return res.status(400).json({ error: 'Valid email required' });

  const user = await prisma.user.findUnique({ where: { email: email.data } });
  if (user && user.account_status === 'active' && !user.email_verified) {
    await createAndSendOtp(user.user_id, user.email, 'verify_email');
  }

  res.json({ message: 'If the account exists and is unverified, a new OTP has been sent.' });
});

// POST /api/auth/login
router.post('/login', loginLimiter, async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { email, password } = parsed.data;
  const user = await prisma.user.findUnique({ where: { email } });

  const passwordOk = await bcrypt.compare(password, user?.password_hash ?? DUMMY_HASH);
  if (!user || !passwordOk) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  if (user.account_status !== 'active') {
    return res.status(403).json({ error: `Account is ${user.account_status}` });
  }

  // FR1.2: unverified accounts cannot use the platform. Send a fresh code
  // (rate limited by the resend cooldown) and tell the client what to show.
  if (!user.email_verified) {
    await createAndSendOtp(user.user_id, user.email, 'verify_email');
    return res.status(403).json({
      error: 'Please verify your email address first. We have sent you a new code.',
      code: 'EMAIL_NOT_VERIFIED',
      email: user.email,
    });
  }

  await establishSession(req, user.user_id, user.role);

  res.json({
    user: {
      user_id: user.user_id,
      email: user.email,
      display_name: user.display_name,
      role: user.role,
      email_verified: user.email_verified,
    },
  });
});

// POST /api/auth/forgot-password
router.post('/forgot-password', authLimiter, async (req, res) => {
  const email = emailSchema.safeParse(req.body?.email);
  if (!email.success) return res.status(400).json({ error: 'Valid email required' });

  const user = await prisma.user.findUnique({ where: { email: email.data } });
  if (user && user.account_status === 'active') {
    await createAndSendOtp(user.user_id, user.email, 'reset_password');
  }

  res.json({ message: 'If an active account matches that email, a password reset OTP was sent.' });
});

// POST /api/auth/reset-password
router.post('/reset-password', authLimiter, async (req, res) => {
  const parsed = resetPasswordSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { email, code, new_password } = parsed.data;
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || user.account_status !== 'active') {
    return res.status(400).json({ error: 'Invalid or expired OTP' });
  }

  const valid = await verifyOtp(user.user_id, code, 'reset_password');
  if (!valid) return res.status(400).json({ error: 'Invalid or expired OTP' });

  const password_hash = await bcrypt.hash(new_password, 12);
  await prisma.user.update({
    where: { user_id: user.user_id },
    data: { password_hash },
  });

  // FR1.4: existing sessions must stop working after a reset.
  await invalidateUserSessions(user.user_id);

  res.json({ message: 'Password updated successfully. You may now log in.' });
});

// GET /api/auth/me
router.get('/me', requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { user_id: req.session.userId },
    select: {
      user_id: true,
      email: true,
      display_name: true,
      role: true,
      email_verified: true,
      account_status: true,
      mentor_profile: {
        select: {
          mentor_profile_id: true,
          bio: true,
          expertise_summary: true,
          verification_status: true,
          review_reason: true,
          reviewed_at: true,
        },
      },
    },
  });
  res.json({ user });
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('connect.sid');
    res.json({ message: 'Logged out' });
  });
});

export default router;
