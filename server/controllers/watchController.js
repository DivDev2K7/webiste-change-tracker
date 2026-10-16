import fs from 'fs/promises';
import path from 'path';
import * as cheerio from 'cheerio';
import Watch from '../models/Watch.js';
import Snapshot from '../models/Snapshot.js';
import { HttpError } from '../middlewares/errorHandler.js';
import { assertPublicUrl, fetchPage } from '../services/scraper.js';
import { validateSelector } from '../services/noiseFilter.js';
import { computeTextDiff, toRenderableParts, screenshotDiff } from '../services/diffEngine.js';
import { enqueueCheck } from '../services/scheduler.js';
import { DISCORD_PREFIXES } from '../services/notifier.js';

const SHOT_DIR = path.resolve(process.env.SCREENSHOT_DIR || './screenshots');
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/* ------------------------------ input validation ------------------------------ */

async function sanitize(body = {}) {
  const out = {};
  if (body.name !== undefined) out.name = String(body.name).trim().slice(0, 100);
  if (body.url !== undefined) out.url = await assertPublicUrl(String(body.url).trim());

  if (body.intervalMinutes !== undefined) {
    const n = Number(body.intervalMinutes);
    if (!Number.isFinite(n) || n < 15 || n > 1440) {
      throw new HttpError(400, 'Check interval must be between 15 minutes and 24 hours');
    }
    out.intervalMinutes = Math.round(n);
  }
  if (body.sensitivity !== undefined) {
    if (!['low', 'medium', 'high'].includes(body.sensitivity)) throw new HttpError(400, 'Sensitivity must be low, medium or high');
    out.sensitivity = body.sensitivity;
  }
  for (const key of ['selectors', 'ignoreSelectors']) {
    if (body[key] === undefined) continue;
    const list = (Array.isArray(body[key]) ? body[key] : []).map((s) => String(s).trim()).filter(Boolean).slice(0, 20);
    for (const sel of list) {
      if (sel.length > 300 || !validateSelector(sel)) throw new HttpError(400, `Invalid CSS selector: ${sel}`);
    }
    out[key] = list;
  }
  if (body.keywords !== undefined) {
    const raw = Array.isArray(body.keywords) ? body.keywords : String(body.keywords).split(',');
    out.keywords = raw.map((k) => String(k).trim()).filter(Boolean).slice(0, 20);
  }
  if (body.active !== undefined) out.active = Boolean(body.active);

  if (body.notify !== undefined) {
    const n = body.notify || {};
    const email = String(n.email || '').trim();
    const discordWebhook = String(n.discordWebhook || '').trim();
    if (email && !EMAIL_RE.test(email)) throw new HttpError(400, 'Enter a valid email address');
    if (discordWebhook && !DISCORD_PREFIXES.some((p) => discordWebhook.startsWith(p))) {
      throw new HttpError(400, 'Discord webhook must start with https://discord.com/api/webhooks/');
    }
    out.notify = {
      email,
      discordWebhook,
      telegramChatId: String(n.telegramChatId || '').trim().slice(0, 64),
      digest: Boolean(n.digest)
    };
  }
  return out;
}

/* ---------------------------------- CRUD ---------------------------------- */

export async function listWatches(req, res) {
  const watches = await Watch.find().sort({ createdAt: -1 });
  res.json(watches);
}

export async function createWatch(req, res) {
  const data = await sanitize(req.body);
  if (!data.url) throw new HttpError(400, 'A URL is required');
  if (!data.name) data.name = new URL(data.url).hostname;
  const watch = await Watch.create(data);
  enqueueCheck(watch._id); // take the baseline snapshot right away
  res.status(201).json(watch);
}

export async function getWatch(req, res) {
  const watch = await Watch.findById(req.params.id);
  if (!watch) throw new HttpError(404, 'Watch not found');
  res.json(watch);
}

export async function updateWatch(req, res) {
  const watch = await Watch.findById(req.params.id);
  if (!watch) throw new HttpError(404, 'Watch not found');
  const data = await sanitize(req.body);

  // If anything that affects the extracted text changes, the next snapshot is a fresh baseline
  // (otherwise editing a selector would look like the page changed and trigger a false alert).
  const textAffecting = ['url', 'selectors', 'ignoreSelectors', 'sensitivity'];
  const changed = textAffecting.some((k) => data[k] !== undefined && JSON.stringify(data[k]) !== JSON.stringify(watch[k]));
  watch.set(data);
  if (changed) {
    watch.rebaseline = true;
    watch.consecutiveChanges = 0;
    watch.noisy = false;
  }
  await watch.save();
  if (changed) enqueueCheck(watch._id);
  res.json(watch);
}

export async function deleteWatch(req, res) {
  const watch = await Watch.findById(req.params.id);
  if (!watch) throw new HttpError(404, 'Watch not found');
  await Snapshot.deleteMany({ watch: watch._id });
  await fs.rm(path.join(SHOT_DIR, String(watch._id)), { recursive: true, force: true });
  await watch.deleteOne();
  res.json({ ok: true });
}

export async function checkNow(req, res) {
  const watch = await Watch.findById(req.params.id);
  if (!watch) throw new HttpError(404, 'Watch not found');
  // basic abuse guard (core question #4): no more than one manual check every 30 seconds per watch
  if (watch.lastChecked && Date.now() - watch.lastChecked.getTime() < 30000) {
    throw new HttpError(429, 'Checked a moment ago. Try again in a few seconds.');
  }
  enqueueCheck(watch._id);
  res.status(202).json({ queued: true });
}

/* ----------------------------- timeline & diffs ----------------------------- */

export async function getSnapshots(req, res) {
  const snaps = await Snapshot.find({ watch: req.params.id }).select('-text').sort({ createdAt: -1 }).limit(100);
  res.json(snaps);
}

export async function getDiff(req, res) {
  const { from, to } = req.query;
  const [a, b] = await Promise.all([
    Snapshot.findOne({ _id: from, watch: req.params.id }),
    Snapshot.findOne({ _id: to, watch: req.params.id })
  ]);
  if (!a || !b) throw new HttpError(404, 'Snapshot not found');

  const diff = computeTextDiff(a.text, b.text);
  const payload = {
    from: { id: a._id, createdAt: a.createdAt, screenshot: a.screenshot && `/screenshots/${a.screenshot}` },
    to: { id: b._id, createdAt: b.createdAt, screenshot: b.screenshot && `/screenshots/${b.screenshot}` },
    parts: toRenderableParts(diff.parts),
    stats: { added: diff.addedLines.length, removed: diff.removedLines.length },
    screenshotDiff: null
  };

  // highlighted screenshot diff, generated on demand and cached on disk
  if (a.screenshot && b.screenshot) {
    try {
      const outRel = `diffs/${a._id}_${b._id}.png`;
      const outAbs = path.join(SHOT_DIR, outRel);
      await fs.mkdir(path.dirname(outAbs), { recursive: true });
      const info = await screenshotDiff(path.join(SHOT_DIR, a.screenshot), path.join(SHOT_DIR, b.screenshot), outAbs);
      payload.screenshotDiff = { url: `/screenshots/${outRel}`, percent: info.percent };
    } catch (err) {
      console.error('[screenshot diff]', err.message);
    }
  }
  res.json(payload);
}

/* ------------------------------ visual picker ------------------------------ */
// Serves a sanitised copy of the RENDERED page (scripts removed) with a small picker script injected.
// Because it comes from our own server, the client iframe can run it without cross-origin problems.

const PICKER_SCRIPT = `
(function () {
  var hover = null;
  var style = document.createElement('style');
  style.textContent = '.__wcd_hover{outline:2px solid #0f766e !important;outline-offset:-2px;cursor:crosshair !important;background-color:rgba(15,118,110,.12) !important}';
  document.head.appendChild(style);

  function esc(s) { return window.CSS && CSS.escape ? CSS.escape(s) : s.replace(/([^\\w-])/g, '\\\\$1'); }
  function selectorFor(el) {
    var parts = [];
    while (el && el.nodeType === 1 && el !== document.body && el !== document.documentElement) {
      if (el.id) { parts.unshift('#' + esc(el.id)); break; }
      var part = el.tagName.toLowerCase();
      var cls = Array.prototype.filter.call(el.classList, function (c) { return /^[a-zA-Z][\\w-]*$/.test(c) && c !== '__wcd_hover'; }).slice(0, 2);
      if (cls.length) part += '.' + cls.map(esc).join('.');
      var sibs = Array.prototype.filter.call(el.parentNode.children, function (s) { return s.tagName === el.tagName; });
      if (sibs.length > 1) part += ':nth-of-type(' + (sibs.indexOf(el) + 1) + ')';
      parts.unshift(part);
      el = el.parentElement;
    }
    return parts.join(' > ');
  }
  document.addEventListener('mouseover', function (e) {
    if (hover) hover.classList.remove('__wcd_hover');
    hover = e.target; hover.classList.add('__wcd_hover');
  }, true);
  document.addEventListener('click', function (e) {
    e.preventDefault(); e.stopPropagation();
    if (hover) hover.classList.remove('__wcd_hover');
    var sel = selectorFor(e.target);
    if (hover) hover.classList.add('__wcd_hover');
    if (sel) window.parent.postMessage({ type: 'wcd-pick', selector: sel }, '*');
  }, true);
})();
`;

export async function previewPage(req, res) {
  const url = await assertPublicUrl(String(req.query.url || ''));
  const result = await fetchPage(url);
  if (result.state !== 'ok') throw new HttpError(502, result.error || 'Could not load the page for preview');

  const $ = cheerio.load(result.html);
  $('script, noscript, iframe, meta[http-equiv="refresh"]').remove();
  $('head').prepend(`<base href="${url.replace(/"/g, '&quot;')}">`);
  $('body').append(`<script>${PICKER_SCRIPT}</script>`);

  res.set({
    'Content-Type': 'text/html; charset=utf-8',
    'Content-Security-Policy': "script-src 'unsafe-inline'"
  });
  res.send($.html());
}
