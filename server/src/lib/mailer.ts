import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import nodemailer from 'nodemailer';
import { OtpPurpose } from '@prisma/client';
import { prisma } from './prisma.js';

export const OTP_TTL_MS = 10 * 60 * 1000;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_RESEND_COOLDOWN_MS = 60 * 1000;

const isProd = process.env.NODE_ENV === 'production';

// NOTE: index.ts must load dotenv BEFORE importing this file, otherwise these
// env vars are read too early and SMTP is never configured.
const smtpPort = Number(process.env.SMTP_PORT) || 587;
const transporter = process.env.SMTP_HOST
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    })
  : null;

/**
 * Creates a fresh OTP (invalidating older ones) and emails it.
 * Returns true if a code was issued, false if it was skipped because a code was
 * requested less than a minute ago or the email could not be sent. Callers must
 * NOT reveal this to the client for forgot/resend (account enumeration).
 */
export async function createAndSendOtp(
  userId: number,
  email: string,
  purpose: OtpPurpose
): Promise<boolean> {
  const recent = await prisma.otpToken.findFirst({
    where: {
      user_id: userId,
      purpose,
      created_at: { gt: new Date(Date.now() - OTP_RESEND_COOLDOWN_MS) },
    },
  });
  if (recent) return false;

  await prisma.otpToken.updateMany({
    where: { user_id: userId, purpose, used: false },
    data: { used: true },
  });

  // 000000-999999, zero padded
  const rawCode = crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
  const codeHash = await bcrypt.hash(rawCode, 10);

  await prisma.otpToken.create({
    data: {
      user_id: userId,
      code_hash: codeHash,
      purpose,
      expires_at: new Date(Date.now() + OTP_TTL_MS),
    },
  });

  const subject =
    purpose === 'verify_email'
      ? 'NeuroConnect - Verify your email'
      : 'NeuroConnect - Password reset code';
  const text = `Your NeuroConnect code is: ${rawCode}. It expires in 10 minutes. If you did not request it, you can ignore this email.`;

  if (transporter) {
    try {
      await transporter.sendMail({
        from: process.env.EMAIL_FROM || 'noreply@neuroconnect.local',
        to: email,
        subject,
        text,
      });
    } catch (err) {
      console.error('[mailer] Failed to send OTP email:', err);
      return false;
    }
  } else if (isProd) {
    // Never print codes in production logs.
    console.error('[mailer] SMTP is not configured; OTP email was not sent.');
    return false;
  } else {
    console.log(`\n[DEV OTP] To: ${email} | Purpose: ${purpose} | Code: ${rawCode}\n`);
  }

  return true;
}

/**
 * Checks a code. Each wrong guess is counted; after OTP_MAX_ATTEMPTS wrong
 * guesses the code is burned and a new one must be requested.
 */
export async function verifyOtp(userId: number, rawCode: string, purpose: OtpPurpose): Promise<boolean> {
  const token = await prisma.otpToken.findFirst({
    where: {
      user_id: userId,
      purpose,
      used: false,
      expires_at: { gt: new Date() },
    },
    orderBy: { created_at: 'desc' },
  });

  if (!token) return false;

  if (token.attempts >= OTP_MAX_ATTEMPTS) {
    await prisma.otpToken.update({ where: { otp_id: token.otp_id }, data: { used: true } });
    return false;
  }

  const isValid = await bcrypt.compare(rawCode, token.code_hash);

  if (!isValid) {
    // Atomic increment; burn the code when the limit is reached.
    const updated = await prisma.otpToken.update({
      where: { otp_id: token.otp_id },
      data: { attempts: { increment: 1 } },
    });
    if (updated.attempts >= OTP_MAX_ATTEMPTS) {
      await prisma.otpToken.update({ where: { otp_id: token.otp_id }, data: { used: true } });
    }
    return false;
  }

  // Single-use: only succeed if we are the request that flips used -> true.
  const claimed = await prisma.otpToken.updateMany({
    where: { otp_id: token.otp_id, used: false },
    data: { used: true },
  });
  return claimed.count === 1;
}
