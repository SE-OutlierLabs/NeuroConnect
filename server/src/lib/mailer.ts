import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import nodemailer from 'nodemailer';
import { OtpPurpose } from '@prisma/client';
import { prisma } from './prisma.js';

const transporter = process.env.SMTP_HOST
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    })
  : null;

export async function createAndSendOtp(userId: number, email: string, purpose: OtpPurpose) {
  await prisma.otpToken.updateMany({
    where: { user_id: userId, purpose, used: false },
    data: { used: true },
  });

  const rawCode = crypto.randomInt(100000, 999999).toString();
  const codeHash = await bcrypt.hash(rawCode, 10);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  await prisma.otpToken.create({
    data: {
      user_id: userId,
      code_hash: codeHash,
      purpose,
      expires_at: expiresAt,
    },
  });

  const subject =
    purpose === 'verify_email'
      ? 'NeuroConnect - Verify your email'
      : 'NeuroConnect - Password reset code';

  if (transporter) {
    await transporter.sendMail({
      from: process.env.EMAIL_FROM || 'noreply@neuroconnect.local',
      to: email,
      subject,
      text: `Your NeuroConnect verification code is: ${rawCode}. It expires in 10 minutes.`,
    });
  } else {
    console.log(`\n[DEV OTP] To: ${email} | Purpose: ${purpose} | Code: ${rawCode}\n`);
  }
}

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

  const isValid = await bcrypt.compare(rawCode, token.code_hash);
  if (!isValid) return false;

  await prisma.otpToken.update({
    where: { otp_id: token.otp_id },
    data: { used: true },
  });

  return true;
}