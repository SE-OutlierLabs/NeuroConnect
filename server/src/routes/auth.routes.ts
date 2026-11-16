import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { createAndSendOtp, verifyOtp } from '../lib/mailer.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

const registerSchema = z.object({
  email: z.string().email().toLowerCase(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  display_name: z.string().min(2).max(50),
  role: z.enum(['mentee', 'mentor']).default('mentee'),
});

const verifyOtpSchema = z.object({
  email: z.string().email().toLowerCase(),
  code: z.string().length(6),
});

const loginSchema = z.object({
  email: z.string().email().toLowerCase(),
  password: z.string().min(1),
});

const resetPasswordSchema = z.object({
  email: z.string().email().toLowerCase(),
  code: z.string().length(6),
  new_password: z.string().min(8),
});

// POST /api/auth/register
router.post('/register', async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { email, password, display_name, role } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return res.status(409).json({ error: 'Email is already registered' });

  const password_hash = await bcrypt.hash(password, 12);

  const user = await prisma.user.create({
    data: {
      email,
      password_hash,
      display_name,
      role,
    },
    select: { user_id: true, email: true, display_name: true, role: true, email_verified: true },
  });

  await createAndSendOtp(user.user_id, user.email, 'verify_email');

  res.status(201).json({
    message: 'Account created. Please verify the 6-digit OTP sent to your email.',
    user,
  });
});

// POST /api/auth/verify-otp
router.post('/verify-otp', async (req, res) => {
  const parsed = verifyOtpSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { email, code } = parsed.data;
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return res.status(404).json({ error: 'User not found' });

  const valid = await verifyOtp(user.user_id, code, 'verify_email');
  if (!valid) return res.status(400).json({ error: 'Invalid or expired OTP' });

  const updated = await prisma.user.update({
    where: { user_id: user.user_id },
    data: { email_verified: true },
    select: { user_id: true, email: true, display_name: true, role: true, email_verified: true },
  });

  req.session.userId = updated.user_id;
  req.session.role = updated.role;

  res.json({ message: 'Email verified successfully', user: updated });
});

// POST /api/auth/resend-otp
router.post('/resend-otp', async (req, res) => {
  const email = z.string().email().toLowerCase().safeParse(req.body?.email);
  if (!email.success) return res.status(400).json({ error: 'Valid email required' });

  const user = await prisma.user.findUnique({ where: { email: email.data } });
  if (user && !user.email_verified) {
    await createAndSendOtp(user.user_id, user.email, 'verify_email');
  }

  res.json({ message: 'If the account exists and is unverified, a new OTP has been sent.' });
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { email, password } = parsed.data;
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  if (user.account_status !== 'active') {
    return res.status(403).json({ error: `Account is ${user.account_status}` });
  }

  req.session.userId = user.user_id;
  req.session.role = user.role;

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
router.post('/forgot-password', async (req, res) => {
  const email = z.string().email().toLowerCase().safeParse(req.body?.email);
  if (!email.success) return res.status(400).json({ error: 'Valid email required' });

  const user = await prisma.user.findUnique({ where: { email: email.data } });
  if (user && user.account_status === 'active') {
    await createAndSendOtp(user.user_id, user.email, 'reset_password');
  }

  res.json({ message: 'If an active account matches that email, a password reset OTP was sent.' });
});

// POST /api/auth/reset-password
router.post('/reset-password', async (req, res) => {
  const parsed = resetPasswordSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { email, code, new_password } = parsed.data;
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return res.status(400).json({ error: 'Invalid reset request' });

  const valid = await verifyOtp(user.user_id, code, 'reset_password');
  if (!valid) return res.status(400).json({ error: 'Invalid or expired OTP' });

  const password_hash = await bcrypt.hash(new_password, 12);
  await prisma.user.update({
    where: { user_id: user.user_id },
    data: { password_hash },
  });

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
      mentor_profile: true,
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