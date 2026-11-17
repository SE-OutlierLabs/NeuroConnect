import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAuth, requireRoles, requireVerifiedEmail } from '../middleware/auth.js';
import { logAudit } from '../lib/audit.js';

const router = Router();

router.use(requireAuth, requireVerifiedEmail, requireRoles('admin', 'moderator'));

const listQuerySchema = z.object({
  status: z.enum(['pending', 'approved', 'rejected']).optional(),
});

// FR3.2: decisions carry a reason. A rejection must explain itself.
const reviewSchema = z
  .object({
    decision: z.enum(['approved', 'rejected']),
    reason: z.string().trim().min(3, 'Please give a short reason').max(500).optional(),
  })
  .refine((v) => v.decision === 'approved' || !!v.reason, {
    message: 'A reason is required when rejecting an application',
    path: ['reason'],
  });

const idParam = z.coerce.number().int().positive();

// GET /api/admin/mentors?status=pending
router.get('/mentors', async (req, res) => {
  const parsed = listQuerySchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const applications = await prisma.mentorProfile.findMany({
    where: parsed.data.status ? { verification_status: parsed.data.status } : undefined,
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
  const profileId = idParam.safeParse(req.params.profileId);
  if (!profileId.success) return res.status(400).json({ error: 'Invalid profile ID' });

  const parsed = reviewSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const reviewerId = req.session.userId!;
  const { decision, reason } = parsed.data;

  const existing = await prisma.mentorProfile.findUnique({
    where: { mentor_profile_id: profileId.data },
  });
  if (!existing) return res.status(404).json({ error: 'Mentor profile not found' });

  // Nobody approves their own application.
  if (existing.user_id === reviewerId) {
    return res.status(403).json({ error: 'You cannot review your own application' });
  }

  // The decision and its audit entry commit together or not at all. The
  // "still pending" condition makes a decision final (no flipping, no double review).
  // The mentor role is assigned at registration; approval only changes verification_status.
  const updatedProfile = await prisma.$transaction(async (tx) => {
    const result = await tx.mentorProfile.updateMany({
      where: { mentor_profile_id: profileId.data, verification_status: 'pending' },
      data: {
        verification_status: decision,
        reviewed_by: reviewerId,
        reviewed_at: new Date(),
        review_reason: reason ?? null,
      },
    });
    if (result.count === 0) return null;

    await logAudit(
      {
        actorId: reviewerId,
        action: `mentor_application_${decision}`,
        targetTable: 'MENTOR_PROFILE',
        targetId: profileId.data,
      },
      tx
    );

    return tx.mentorProfile.findUnique({ where: { mentor_profile_id: profileId.data } });
  });

  if (!updatedProfile) {
    return res.status(409).json({
      error: `This application has already been ${existing.verification_status === 'pending' ? 'reviewed' : existing.verification_status}`,
    });
  }

  res.json({ message: `Mentor application ${decision}`, profile: updatedProfile });
});

// GET /api/admin/audit-logs  (admins only)
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
