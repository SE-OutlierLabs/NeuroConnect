import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAuth, requireVerifiedEmail } from '../middleware/auth.js';

const router = Router();

const applySchema = z.object({
  bio: z.string().min(20, 'Bio must be at least 20 characters'),
  expertise_summary: z.string().min(10, 'Expertise summary must be at least 10 characters'),
  verification_doc_key: z.string().min(3, 'Verification document key is required'),
});

const connectSchema = z.object({
  mentor_user_id: z.number().int().positive(),
});

const respondSchema = z.object({
  decision: z.enum(['accepted', 'declined']),
});

// POST /api/mentors/apply
router.post('/apply', requireAuth, requireVerifiedEmail, async (req, res) => {
  const parsed = applySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const userId = req.session.userId!;

  const existing = await prisma.mentorProfile.findUnique({ where: { user_id: userId } });
  if (existing) {
    return res.status(409).json({ error: 'You have already submitted a mentor profile' });
  }

  const profile = await prisma.mentorProfile.create({
    data: {
      user_id: userId,
      bio: parsed.data.bio,
      expertise_summary: parsed.data.expertise_summary,
      verification_doc_key: parsed.data.verification_doc_key,
      verification_status: 'pending',
    },
  });

  res.status(201).json({
    message: 'Mentor application submitted and awaiting moderator review.',
    profile,
  });
});

// GET /api/mentors?q=adhd
router.get('/', requireAuth, async (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';

  const mentors = await prisma.mentorProfile.findMany({
    where: {
      verification_status: 'approved',
      user: { account_status: 'active' },
      ...(q
        ? {
            OR: [
              { bio: { contains: q, mode: 'insensitive' } },
              { expertise_summary: { contains: q, mode: 'insensitive' } },
              { user: { display_name: { contains: q, mode: 'insensitive' } } },
            ],
          }
        : {}),
    },
    select: {
      mentor_profile_id: true,
      user_id: true,
      bio: true,
      expertise_summary: true,
      verification_status: true,
      user: {
        select: {
          user_id: true,
          display_name: true,
        },
      },
    },
  });

  res.json({ mentors });
});

// POST /api/mentors/connect
router.post('/connect', requireAuth, requireVerifiedEmail, async (req, res) => {
  const parsed = connectSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const menteeId = req.session.userId!;
  const { mentor_user_id } = parsed.data;

  if (menteeId === mentor_user_id) {
    return res.status(400).json({ error: 'You cannot request mentorship from yourself' });
  }

  const mentorProfile = await prisma.mentorProfile.findUnique({
    where: { user_id: mentor_user_id },
    include: { user: { select: { account_status: true } } },
  });

  if (
    !mentorProfile ||
    mentorProfile.verification_status !== 'approved' ||
    mentorProfile.user.account_status !== 'active'
  ) {
    return res.status(404).json({ error: 'Approved mentor not found' });
  }

  const existingMatch = await prisma.matchRequest.findFirst({
    where: {
      mentee_id: menteeId,
      mentor_id: mentor_user_id,
      status: { in: ['pending', 'accepted'] },
    },
  });

  if (existingMatch) {
    return res.status(409).json({
      error: `You already have a ${existingMatch.status} match with this mentor`,
    });
  }

  const matchRequest = await prisma.matchRequest.create({
    data: {
      mentee_id: menteeId,
      mentor_id: mentor_user_id,
      status: 'pending',
    },
  });

  res.status(201).json({ message: 'Mentorship request sent', match: matchRequest });
});

// GET /api/mentors/connections
router.get('/connections', requireAuth, async (req, res) => {
  const userId = req.session.userId!;

  const [sent, received] = await Promise.all([
    prisma.matchRequest.findMany({
      where: { mentee_id: userId },
      include: { mentor: { select: { user_id: true, display_name: true } } },
      orderBy: { requested_at: 'desc' },
    }),
    prisma.matchRequest.findMany({
      where: { mentor_id: userId },
      include: { mentee: { select: { user_id: true, display_name: true } } },
      orderBy: { requested_at: 'desc' },
    }),
  ]);

  res.json({ sent, received });
});

// PATCH /api/mentors/connections/:matchId/respond
router.patch('/connections/:matchId/respond', requireAuth, async (req, res) => {
  const matchId = Number(req.params.matchId);
  if (Number.isNaN(matchId)) return res.status(400).json({ error: 'Invalid match ID' });

  const parsed = respondSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const mentorId = req.session.userId!;
  const match = await prisma.matchRequest.findUnique({ where: { match_id: matchId } });

  if (!match || match.mentor_id !== mentorId) {
    return res.status(404).json({ error: 'Match request not found' });
  }

  if (match.status !== 'pending') {
    return res.status(400).json({ error: `Match request is already ${match.status}` });
  }

  const updated = await prisma.matchRequest.update({
    where: { match_id: matchId },
    data: {
      status: parsed.data.decision,
      responded_at: new Date(),
    },
  });

  res.json({ message: `Match request ${parsed.data.decision}`, match: updated });
});

// GET /api/mentors/suggested
router.get('/suggested', requireAuth, async (req, res) => {
  const menteeId = req.session.userId!;

  const existingMatches = await prisma.matchRequest.findMany({
    where: { mentee_id: menteeId, status: { in: ['pending', 'accepted'] } },
    select: { mentor_id: true },
  });
  const excludedIds = existingMatches.map((m) => m.mentor_id);

  const mentors = await prisma.mentorProfile.findMany({
    where: {
      verification_status: 'approved',
      user: { account_status: 'active' },
      user_id: { notIn: excludedIds },
    },
    select: {
      mentor_profile_id: true,
      user_id: true,
      bio: true,
      expertise_summary: true,
      user: { select: { display_name: true } },
    },
  });

  const ranked = await Promise.all(
    mentors.map(async (m) => {
      const activeCount = await prisma.matchRequest.count({
        where: { mentor_id: m.user_id, status: 'accepted' },
      });
      const reason =
        activeCount === 0 ? 'available' : activeCount <= 2 ? 'low current mentee load' : 'experienced';
      return { ...m, active_mentee_count: activeCount, reason };
    })
  );

  ranked.sort((a, b) => a.active_mentee_count - b.active_mentee_count);

  res.json({ suggested: ranked });
});


export default router;