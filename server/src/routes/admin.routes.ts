import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAuth, requireRoles } from '../middleware/auth.js';
import { logAudit } from '../lib/audit.js';

const router = Router();

router.use(requireAuth, requireRoles('admin', 'moderator'));

const reviewSchema = z.object({
  decision: z.enum(['approved', 'rejected']),
});

// GET /api/admin/mentors?status=pending
router.get('/mentors', async (req, res) => {
  const statusParam = req.query.status as 'pending' | 'approved' | 'rejected' | undefined;

  const applications = await prisma.mentorProfile.findMany({
    where: statusParam ? { verification_status: statusParam } : undefined,
    include: {
      user: {
        select: { user_id: true, display_name: true, email: true, created_at: true },
      },
      reviewer: {
        select: { user_id: true, display_name: true },
      },
    },
    orderBy: { mentor_profile_id: 'asc' },
  });

  res.json({ applications });
});

// PATCH /api/admin/mentors/:profileId/review
router.patch('/mentors/:profileId/review', async (req, res) => {
  const profileId = Number(req.params.profileId);
  if (Number.isNaN(profileId)) return res.status(400).json({ error: 'Invalid profile ID' });

  const parsed = reviewSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const reviewerId = req.session.userId!;
  const { decision } = parsed.data;

  const existing = await prisma.mentorProfile.findUnique({
    where: { mentor_profile_id: profileId },
  });
  if (!existing) return res.status(404).json({ error: 'Mentor profile not found' });

  const updatedProfile = await prisma.$transaction(async (tx) => {
    const profile = await tx.mentorProfile.update({
      where: { mentor_profile_id: profileId },
      data: {
        verification_status: decision,
        reviewed_by: reviewerId,
        reviewed_at: new Date(),
      },
    });

    if (decision === 'approved') {
      await tx.user.update({
        where: { user_id: existing.user_id },
        data: { role: 'mentor' },
      });
    }

    return profile;
  });

  await logAudit({
    actorId: reviewerId,
    action: `mentor_application_${decision}`,
    targetTable: 'MENTOR_PROFILE',
    targetId: profileId,
  });

  res.json({ message: `Mentor application ${decision}`, profile: updatedProfile });
});

// GET /api/admin/audit-logs
router.get('/audit-logs', requireRoles('admin'), async (_req, res) => {
  const logs = await prisma.auditLog.findMany({
    include: {
      actor: { select: { user_id: true, display_name: true, role: true } },
    },
    orderBy: { occurred_at: 'desc' },
    take: 100,
  });

  res.json({ logs });
});

export default router;