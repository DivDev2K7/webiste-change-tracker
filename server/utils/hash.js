import crypto from 'crypto';

// SHA-256 hex digest. Used to decide "did the (filtered) content change?" cheaply.
export const sha256 = (input) =>
  crypto.createHash('sha256').update(String(input), 'utf8').digest('hex');
