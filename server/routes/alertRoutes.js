import { Router } from 'express';
import Snapshot from '../models/Snapshot.js';
import { asyncHandler, HttpError } from '../middlewares/errorHandler.js';
import { sendTest, hasChannels } from '../services/notifier.js';
import { runDigest } from '../services/scheduler.js';

const router = Router();

// Recent alert activity (sent / queued for digest / suppressed + why)
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const snaps = await Snapshot.find({ 'alert.status': { $in: ['sent', 'digest', 'suppressed', 'failed'] } })
      .select('-text')
      .populate('watch', 'name url')
      .sort({ createdAt: -1 })
      .limit(limit);
    res.json(snaps);
  })
);

// Send a test message to the channels in the request body
router.post(
  '/test',
  asyncHandler(async (req, res) => {
    const { email = '', discordWebhook = '', telegramChatId = '' } = req.body || {};
    const notify = { email, discordWebhook, telegramChatId };
    if (!hasChannels(notify)) throw new HttpError(400, 'Add an email, Discord webhook or Telegram chat ID first');
    try {
      const result = await sendTest(notify);
      res.json(result);
    } catch (err) {
      throw new HttpError(502, err.message);
    }
  })
);

// Send the pending daily digest right now
router.post(
  '/digest',
  asyncHandler(async (req, res) => {
    res.json({ digestsSent: await runDigest() });
  })
);

export default router;
