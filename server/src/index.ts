// MUST be the first import: loads .env before any other module reads process.env
// (mailer.ts reads SMTP_* at import time).
import 'dotenv/config';
import { createApp } from './app.js';

const PORT = process.env.PORT || 4000;
const app = createApp();

app.listen(PORT, () => {
  console.log(`NeuroConnect API running on http://localhost:${PORT}`);
});
