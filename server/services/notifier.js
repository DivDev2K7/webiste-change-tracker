// Requirement 7: alerts via email + Telegram/Discord webhook, with summary and diff link.
import nodemailer from 'nodemailer';

const clientUrl = () => (process.env.CLIENT_URL || 'http://localhost:5173').replace(/\/$/, '');
export const diffLink = (watch, snap) => `${clientUrl()}/watch/${watch._id}?to=${snap._id}`;

export const DISCORD_PREFIXES = ['https://discord.com/api/webhooks/', 'https://discordapp.com/api/webhooks/'];

let transporter = null;
function getTransporter() {
  if (!process.env.SMTP_HOST) throw new Error('SMTP is not configured on the server');
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined
    });
  }
  return transporter;
}

async function sendEmail(to, subject, text) {
  await getTransporter().sendMail({ from: process.env.MAIL_FROM || process.env.SMTP_USER, to, subject, text });
}

async function postJson(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10000)
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}

async function sendDiscord(webhook, subject, text) {
  if (!DISCORD_PREFIXES.some((p) => webhook.startsWith(p))) throw new Error('Not a Discord webhook URL');
  await postJson(webhook, { content: `**${subject}**\n${text}`.slice(0, 1900) });
}

async function sendTelegram(chatId, subject, text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN is not configured on the server');
  await postJson(`https://api.telegram.org/bot${token}/sendMessage`, {
    chat_id: chatId,
    text: `${subject}\n\n${text}`.slice(0, 4000),
    disable_web_page_preview: true
  });
}

export const hasChannels = (n = {}) => Boolean(n.email || n.discordWebhook || n.telegramChatId);

/** Sends to every configured channel. Throws only if ALL channels fail. */
export async function deliver(notify, { subject, text }) {
  const jobs = [];
  if (notify.email) jobs.push(['email', sendEmail(notify.email, subject, text)]);
  if (notify.discordWebhook) jobs.push(['discord', sendDiscord(notify.discordWebhook, subject, text)]);
  if (notify.telegramChatId) jobs.push(['telegram', sendTelegram(notify.telegramChatId, subject, text)]);

  const results = await Promise.allSettled(jobs.map((j) => j[1]));
  const sent = [];
  const errors = [];
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') sent.push(jobs[i][0]);
    else errors.push(`${jobs[i][0]}: ${r.reason?.message || r.reason}`);
  });
  if (!sent.length) throw new Error(errors.join('; ') || 'No notification channel configured');
  return { sent, errors };
}

export function sendChangeAlert(watch, snap) {
  return deliver(watch.notify, {
    subject: `Change detected: ${watch.name}`,
    text: `${snap.summary}\n\nPage: ${watch.url}\nView diff: ${diffLink(watch, snap)}`
  });
}

export function sendStatusAlert(watch, message) {
  return deliver(watch.notify, {
    subject: `Problem checking: ${watch.name}`,
    text: `${message}\n\nPage: ${watch.url}\nOpen watch: ${clientUrl()}/watch/${watch._id}`
  });
}

export function sendDigest(watch, snaps) {
  const lines = snaps.slice(0, 10).map((s) => `- ${s.createdAt.toISOString().slice(0, 16).replace('T', ' ')} UTC: ${s.summary}\n  ${diffLink(watch, s)}`);
  const more = snaps.length > 10 ? `\n...and ${snaps.length - 10} more` : '';
  return deliver(watch.notify, {
    subject: `Daily digest: ${watch.name} (${snaps.length} change${snaps.length > 1 ? 's' : ''})`,
    text: `${lines.join('\n')}${more}\n\nPage: ${watch.url}`
  });
}

export function sendTest(notify) {
  return deliver(notify, {
    subject: 'Website Change Detector: test alert',
    text: 'If you can read this, alerts are working.'
  });
}
