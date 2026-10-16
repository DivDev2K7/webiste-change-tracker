import 'dotenv/config'; // must be first so env vars exist before other modules read them
import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import connectDB from './config/db.js';
import watchRoutes from './routes/watchRoutes.js';
import alertRoutes from './routes/alertRoutes.js';
import demoRoutes, { DEMO_URL } from './routes/demoRoutes.js';
import { authStatus, login, requireAuth } from './controllers/authController.js';
import { asyncHandler, errorHandler, notFound } from './middlewares/errorHandler.js';
import { startScheduler } from './services/scheduler.js';
import { closeBrowser } from './services/scraper.js';

const app = express();
const PORT = process.env.PORT || 5000;
const SHOT_DIR = path.resolve(process.env.SCREENSHOT_DIR || './screenshots');
fs.mkdirSync(SHOT_DIR, { recursive: true });

app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173' }));
app.use(express.json({ limit: '100kb' }));

app.get('/api/health', (req, res) => res.json({ ok: true }));
app.get('/api/config', (req, res) => res.json({ demoUrl: DEMO_URL }));
app.get('/api/auth/status', authStatus);
app.post('/api/auth/login', asyncHandler(async (req, res) => login(req, res)));

app.use('/screenshots', express.static(SHOT_DIR, { maxAge: '7d', immutable: true }));
app.use('/demo', demoRoutes);
app.use('/api/watches', requireAuth, watchRoutes);
app.use('/api/alerts', requireAuth, alertRoutes);

app.use(notFound);
app.use(errorHandler);

async function main() {
  await connectDB();
  startScheduler();
  const server = app.listen(PORT, () => console.log(`[server] http://localhost:${PORT}`));

  const shutdown = async () => {
    server.close();
    await closeBrowser();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error('Fatal startup error:', err.message);
  process.exit(1);
});
