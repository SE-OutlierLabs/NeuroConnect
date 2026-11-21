import { Router } from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { requireAuth, requireRoles, requireVerifiedEmail } from '../middleware/auth.js';

const router = Router();

const UPLOAD_ROOT = path.join(process.cwd(), 'uploads', 'verification');
const ALLOWED_MIME = new Set(['application/pdf', 'image/jpeg', 'image/png']);

const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const userId = req.session.userId!;
    const dir = path.join(UPLOAD_ROOT, String(userId));
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    // Strip anything that isn't letters/digits/dot/dash/underscore so the
    // final key always matches the apply route's key regex.
    const safeName = file.originalname.replace(/[^A-Za-z0-9._-]/g, '_');
    cb(null, `${Date.now()}-${safeName}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME.has(file.mimetype)) {
      return cb(new Error('Only PDF, JPEG, or PNG files are allowed'));
    }
    cb(null, true);
  },
});

// POST /api/mentors/verification-doc
router.post(
  '/verification-doc',
  requireAuth,
  requireVerifiedEmail,
  requireRoles('mentor'),
  (req, res) => {
    upload.single('document')(req, res, (err) => {
      if (err) return res.status(400).json({ error: err.message });
      if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

      const userId = req.session.userId!;
      const key = `verification/${userId}/${req.file.filename}`;
      res.status(201).json({ key });
    });
  }
);

export default router;