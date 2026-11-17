import { Router } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { requireAuth, requireRoles, requireVerifiedEmail } from '../middleware/auth.js';

const router = Router();

// Matching rule (docs/matching-rules.md): a mentor can have at most 3 concurrently accepted mentees.
const MAX_ACTIVE_MENTEES = 3;

const applySchema = z.object({
  bio: z.string().trim().min(20, 'Bio must be at least 20 characters').max(2000),
  expertise_summary: z.string().trim().min(10, 'Expertise summary must be at least 10 characters').max(1000),
  // Optional supporting document (SRS FR3.1). Until the upload endpoint exists
  // this is only a storage key; the server checks it belongs to the applicant.
  verification_doc_key: z
    .string()
    .max(255)
    .regex(/^[A-Za-z0-9._\-\/]+$/, 'Invalid document key')
    .optional(),
});

const connectSchema = z.object({
  mentor_user_id: z.number().int().positive(),
});

const respondSchema = z.object({
  decision: z.enum(['accepted', 'declined']),
});

const idParam = z.coerce.number().int().positive();

const searchSchema = z.object({
  q: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

// POST /api/mentors/apply  (only users who registered as Mentor)
router.post('/apply', requireAuth, requireVerifiedEmail, requireRoles('mentor'), async (req, res) => {
  const parsed = applySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const userId = req.session.userId!;
  const { bio, expertise_summary, verification_doc_key } = parsed.data;

  // Never trust a client-supplied storage key: it must live under the applicant's own folder.
  if (verification_doc_key && !verification_doc_key.startsWith(`verification/${userId}/`)) {
    return res.status(400).json({ error: 'Invalid document key' });
  }

  const existing = await prisma.mentorProfile.findUnique({ where: { user_id: userId } });

  if (existing && existing.verification_status !== 'rejected') {
    return res.status(409).json({
      error:
        existing.verification_status === 'approved'
          ? 'Your mentor profile is already approved'
          : 'Your application is already awaiting review',
    });
  }

  // First application, or a re-application after a rejection.
  const profile = existing
    ? await prisma.mentorProfile.update({
        where: { user_id: userId },
        data: {
          bio,
          expertise_summary,
          verification_doc_key: verification_doc_key ?? null,
          verification_status: 'pending',
          reviewed_by: null,
          reviewed_at: null,
          review_reason: null,
        },
      })
    : await prisma.mentorProfile.create({
        data: {
          user_id: userId,
          bio,
          expertise_summary,
          verification_doc_key: verification_doc_key ?? null,
          verification_status: 'pending',
        },
      });

  res.status(existing ? 200 : 201).json({
    message: 'Mentor application submitted and awaiting admin review.',
    profile: {
      mentor_profile_id: profile.mentor_profile_id,
      bio: profile.bio,
      expertise_summary: profile.expertise_summary,
      verification_status: profile.verification_status,
    },
  });
});

// GET /api/mentors?q=adhd&page=1&limit=20  (mentees search approved mentors)
router.get('/', requireAuth, requireVerifiedEmail, requireRoles('mentee'), async (req, res) => {
  const parsed = searchSchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { q, page, limit } = parsed.data;

  const where: Prisma.MentorProfileWhereInput = {
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
  };

  const [total, mentors] = await Promise.all([
    prisma.mentorProfile.count({ where }),
    prisma.mentorProfile.findMany({
      where,
      select: {
        mentor_profile_id: true,
        user_id: true,
        bio: true,
        expertise_summary: true,
        user: { select: { user_id: true, display_name: true } },
      },
      orderBy: { mentor_profile_id: 'asc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  res.json({ mentors, page, limit, total });
});

// POST /api/mentors/connect  (mentees only)
router.post('/connect', requireAuth, requireVerifiedEmail, requireRoles('mentee'), async (req, res) => {
  const parsed = connectSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const menteeId = req.session.userId!;
  const { mentor_user_id } = parsed.data;

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

  try {
    // Serializable: two simultaneous clicks cannot both pass the "no existing request" check.
    const result = await prisma.$transaction(
      async (tx) => {
        const activeMenteeCount = await tx.matchRequest.count({
          where: { mentor_id: mentor_user_id, status: 'accepted' },
        });
        if (activeMenteeCount >= MAX_ACTIVE_MENTEES) return { full: true } as const;

        const existingMatch = await tx.matchRequest.findFirst({
          where: {
            mentee_id: menteeId,
            mentor_id: mentor_user_id,
            status: { in: ['pending', 'accepted'] },
          },
        });
        if (existingMatch) return { duplicate: existingMatch.status } as const;

        const match = await tx.matchRequest.create({
          data: { mentee_id: menteeId, mentor_id: mentor_user_id, status: 'pending' },
        });
        return { match } as const;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );

    if ('full' in result) {
      return res.status(409).json({ error: 'This mentor is at full capacity' });
    }
    if ('duplicate' in result) {
      return res.status(409).json({ error: `You already have a ${result.duplicate} match with this mentor` });
    }
    res.status(201).json({ message: 'Mentorship request sent', match: result.match });
  } catch (err) {
    // P2034 = serialization conflict, i.e. a concurrent identical request won.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2034') {
      return res.status(409).json({ error: 'You already have a pending request with this mentor' });
    }
    throw err;
  }
});

// GET /api/mentors/suggested  (mentees: approved, under-capacity mentors, least-loaded first)
router.get('/suggested', requireAuth, requireVerifiedEmail, requireRoles('mentee'), async (req, res) => {
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
      if (activeCount >= MAX_ACTIVE_MENTEES) return null; // at capacity, don't suggest
      const reason = activeCount === 0 ? 'available' : 'low current mentee load';
      return { ...m, active_mentee_count: activeCount, reason };
    })
  );

  const available = ranked.filter((r) => r !== null);
  available.sort((a, b) => a.active_mentee_count - b.active_mentee_count);

  res.json({ suggested: available });
});

// GET /api/mentors/connections
router.get('/connections', requireAuth, requireVerifiedEmail, async (req, res) => {
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

// PATCH /api/mentors/connections/:matchId/respond  (the requested mentor only)
router.patch(
  '/connections/:matchId/respond',
  requireAuth,
  requireVerifiedEmail,
  requireRoles('mentor'),
  async (req, res) => {
    const matchId = idParam.safeParse(req.params.matchId);
    if (!matchId.success) return res.status(400).json({ error: 'Invalid match ID' });

    const parsed = respondSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const mentorId = req.session.userId!;

    const profile = await prisma.mentorProfile.findUnique({ where: { user_id: mentorId } });
    if (!profile || profile.verification_status !== 'approved') {
      return res.status(403).json({ error: 'Your mentor profile has not been approved' });
    }

    const match = await prisma.matchRequest.findUnique({ where: { match_id: matchId.data } });
    if (!match || match.mentor_id !== mentorId) {
      return res.status(404).json({ error: 'Match request not found' });
    }

    // Atomic: only succeeds if the request is STILL pending (no double responses).
    const result = await prisma.matchRequest.updateMany({
      where: { match_id: matchId.data, mentor_id: mentorId, status: 'pending' },
      data: { status: parsed.data.decision, responded_at: new Date() },
    });
    if (result.count === 0) {
      return res.status(409).json({ error: 'This request has already been answered' });
    }

    const updated = await prisma.matchRequest.findUnique({ where: { match_id: matchId.data } });
    res.json({ message: `Match request ${parsed.data.decision}`, match: updated });
  }
);

export default router;
