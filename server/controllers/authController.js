// OPTIONAL basic login. Disabled unless AUTH_PASSWORD is set in the environment.
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { HttpError } from '../middlewares/errorHandler.js';

const enabled = () => Boolean(process.env.AUTH_PASSWORD);
const secret = () => process.env.JWT_SECRET || process.env.AUTH_PASSWORD;
const digest = (s) => crypto.createHash('sha256').update(String(s)).digest();

export const authStatus = (req, res) => res.json({ enabled: enabled() });

export const login = (req, res) => {
  if (!enabled()) return res.json({ token: null });
  const ok = crypto.timingSafeEqual(digest(req.body?.password ?? ''), digest(process.env.AUTH_PASSWORD));
  if (!ok) throw new HttpError(401, 'Wrong password');
  res.json({ token: jwt.sign({ role: 'admin' }, secret(), { expiresIn: '7d' }) });
};

export function requireAuth(req, res, next) {
  if (!enabled()) return next();
  const header = req.headers.authorization || '';
  // ?token= lets <iframe>/<img> requests (which can't set headers) authenticate too
  const token = header.startsWith('Bearer ') ? header.slice(7) : req.query.token;
  try {
    jwt.verify(token, secret());
    next();
  } catch {
    next(new HttpError(401, 'Login required'));
  }
}
