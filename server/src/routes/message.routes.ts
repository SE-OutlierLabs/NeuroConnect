import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

const sendSchema = z.object({
  content: z.string().min(1).max(2000),
});

const reportSchema = z.object({
  reason: z.string().min(5).max(500),
});

// POST /api/matches/:matchId/messages
router.post('/matches/:matchId/messages', requireAuth, async (req, res) => {
  const matchId = Number(req.params.matchId);
  if (Number.isNaN(matchId)) return res.status(400).json({ error: 'Invalid match ID' });

  const parsed = sendSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const senderId = req.session.userId!;

  const match = await prisma.matchRequest.findUnique({ where: { match_id: matchId } });
  if (!match || (match.mentee_id !== senderId && match.mentor_id !== senderId)) {
    return res.status(404).json({ error: 'Match not found' });
  }
  if (match.status !== 'accepted') {
    return res.status(403).json({ error: 'You can only message within an accepted match' });
  }

  const message = await prisma.message.create({
    data: { match_id: matchId, sender_id: senderId, content: parsed.data.content },
  });

  res.status(201).json({ message });
});

// GET /api/matches/:matchId/messages
router.get('/matches/:matchId/messages', requireAuth, async (req, res) => {
  const matchId = Number(req.params.matchId);
  if (Number.isNaN(matchId)) return res.status(400).json({ error: 'Invalid match ID' });

  const userId = req.session.userId!;
  const match = await prisma.matchRequest.findUnique({ where: { match_id: matchId } });
  if (!match || (match.mentee_id !== userId && match.mentor_id !== userId)) {
    return res.status(404).json({ error: 'Match not found' });
  }

  const messages = await prisma.message.findMany({
    where: { match_id: matchId, is_hidden: false },
    include: { sender: { select: { user_id: true, display_name: true } } },
    orderBy: { sent_at: 'asc' },
  });

  res.json({ messages });
});

// POST /api/messages/:messageId/report
router.post('/messages/:messageId/report', requireAuth, async (req, res) => {
  const messageId = Number(req.params.messageId);
  if (Number.isNaN(messageId)) return res.status(400).json({ error: 'Invalid message ID' });

  const parsed = reportSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const reporterId = req.session.userId!;
  const message = await prisma.message.findUnique({ where: { message_id: messageId } });
  if (!message) return res.status(404).json({ error: 'Message not found' });

  const report = await prisma.report.create({
    data: {
      message_id: messageId,
      reported_by: reporterId,
      reason: parsed.data.reason,
    },
  });

  res.status(201).json({ message: 'Report submitted', report });
});

export default router;