import 'dotenv/config';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import bcrypt from 'bcryptjs';
import { prisma } from '../src/lib/prisma.js';

describe('match accept/decline concurrency', () => {
  let menteeId: number;
  let mentorId: number;
  let matchId: number;

  beforeAll(async () => {
    const passwordHash = await bcrypt.hash('TestPassword123!', 10);

    const mentee = await prisma.user.create({
      data: {
        email: `concurrency-mentee-${Date.now()}@test.local`,
        password_hash: passwordHash,
        display_name: 'Concurrency Test Mentee',
        role: 'mentee',
        email_verified: true,
      },
    });
    menteeId = mentee.user_id;

    const mentor = await prisma.user.create({
      data: {
        email: `concurrency-mentor-${Date.now()}@test.local`,
        password_hash: passwordHash,
        display_name: 'Concurrency Test Mentor',
        role: 'mentor',
        email_verified: true,
        mentor_profile: {
          create: {
            bio: 'Test mentor bio used only for the concurrency test.',
            expertise_summary: 'Testing',
            verification_status: 'approved',
            verification_doc_key: 'test-key',
          },
        },
      },
    });
    mentorId = mentor.user_id;

    const match = await prisma.matchRequest.create({
      data: { mentee_id: menteeId, mentor_id: mentorId, status: 'pending' },
    });
    matchId = match.match_id;
  });

  afterAll(async () => {
    await prisma.matchRequest.deleteMany({ where: { match_id: matchId } });
    await prisma.mentorProfile.deleteMany({ where: { user_id: mentorId } });
    await prisma.user.deleteMany({ where: { user_id: { in: [menteeId, mentorId] } } });
    await prisma.$disconnect();
  });

  it('only allows ONE of two simultaneous responses to succeed', async () => {
    // Fires both "respond" attempts at the exact same instant — this is
    // the same atomic updateMany your route uses.
    const [acceptResult, declineResult] = await Promise.all([
      prisma.matchRequest.updateMany({
        where: { match_id: matchId, mentor_id: mentorId, status: 'pending' },
        data: { status: 'accepted', responded_at: new Date() },
      }),
      prisma.matchRequest.updateMany({
        where: { match_id: matchId, mentor_id: mentorId, status: 'pending' },
        data: { status: 'declined', responded_at: new Date() },
      }),
    ]);

    const totalUpdated = acceptResult.count + declineResult.count;
    expect(totalUpdated).toBe(1); // exactly one write wins, never both

    const finalMatch = await prisma.matchRequest.findUnique({ where: { match_id: matchId } });
    expect(['accepted', 'declined']).toContain(finalMatch?.status);
  });
});