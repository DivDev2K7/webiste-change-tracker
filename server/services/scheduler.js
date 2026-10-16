// Requirement 2: scheduler + job queue with timeouts and retries.
// Also implements the noise-control side of core question #3 (endless alerts) and #4 (rate limits).
import cron from 'node-cron';
import fs from 'fs/promises';
import path from 'path';
import Watch from '../models/Watch.js';
import Snapshot from '../models/Snapshot.js';
import { fetchPage } from './scraper.js';
import { buildText } from './noiseFilter.js';
import { computeTextDiff, summarize } from './diffEngine.js';
import { summarizeChange } from './summarizer.js';
import { broadcast } from './broadcaster.js';
import { sendChangeAlert, sendStatusAlert, sendDigest, hasChannels } from './notifier.js';
import { sha256 } from '../utils/hash.js';

const num = (key, fallback) => {
  const v = process.env[key];
  return v !== undefined && v !== '' && Number.isFinite(Number(v)) ? Number(v) : fallback;
};

const CONCURRENCY = num('QUEUE_CONCURRENCY', 2); // max checks running at once
const JOB_TIMEOUT = num('JOB_TIMEOUT_SECONDS', 90) * 1000;
const MAX_RETRIES = num('MAX_RETRIES', 2);
const RETRY_BASE = num('RETRY_BASE_SECONDS', 5) * 1000; // 5s, 10s, 20s ...
const FAILURE_ALERT_AFTER = num('FAILURE_ALERT_AFTER', 3); // alert about outages only after N failed checks in a row
const NOISY_AFTER = num('NOISY_AFTER_CHANGES', 5); // N consecutive changing checks => page is "noisy"
const ALERT_COOLDOWN = num('ALERT_COOLDOWN_MINUTES', 30) * 60000;
const MAX_SNAPSHOTS = num('MAX_SNAPSHOTS_PER_WATCH', 50);
const SHOT_DIR = path.resolve(process.env.SCREENSHOT_DIR || './screenshots');

// Sensitivity = minimum share of the text that must change before we alert (storage is unaffected).
const THRESHOLD = { high: 0, medium: 0.005, low: 0.03 };

function watchPayload(watch, latestSummary = watch.lastSummary) {
  return {
    _id: String(watch._id),
    name: watch.name,
    url: watch.url,
    lastChecked: watch.lastChecked,
    lastChanged: watch.lastChanged,
    active: watch.active,
    noisy: watch.noisy,
    status: watch.status,
    lastError: watch.lastError,
    lastSummary: latestSummary,
    latestSummary,
    intervalMinutes: watch.intervalMinutes
  };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const withTimeout = (promise, ms, label) =>
  Promise.race([promise, new Promise((_, rej) => setTimeout(() => rej(new Error(label)), ms))]);

/* ------------------------------ In-memory job queue ------------------------------ */

const queue = [];
const queued = new Set(); // a watch is never queued twice
let running = 0;

export function enqueueCheck(watchId) {
  const id = String(watchId);
  if (queued.has(id)) return false;
  queued.add(id);
  queue.push(id);
  pump();
  return true;
}

function pump() {
  while (running < CONCURRENCY && queue.length) {
    const id = queue.shift();
    running++;
    runJob(id).finally(() => {
      running--;
      queued.delete(id);
      pump();
    });
  }
}

async function runJob(id) {
  try {
    await withTimeout(runCheck(id), JOB_TIMEOUT, `Check timed out after ${JOB_TIMEOUT / 1000}s`);
  } catch (err) {
    console.error(`[check ${id}]`, err.message);
    const watch = await Watch.findById(id).catch(() => null);
    if (watch) await recordFailure(watch, { state: 'error', error: err.message }).catch(() => {});
  }
}

/* --------------------------------- Scheduling --------------------------------- */

function scheduleNext(watch) {
  const base = watch.intervalMinutes * 60000;
  // exponential back-off while a site keeps failing (max 8x the interval)
  const backoff = watch.consecutiveFailures > 0 ? Math.min(2 ** Math.min(watch.consecutiveFailures, 4), 8) : 1;
  const jitter = Math.random() * 0.1 * base; // spread load so watches don't all fire together
  watch.nextCheckAt = new Date(Date.now() + base * backoff + jitter);
}

async function tick() {
  // sorted by url so watches of the same page run back-to-back and share one cached fetch
  const due = await Watch.find({ active: true, nextCheckAt: { $lte: new Date() } })
    .sort({ url: 1 })
    .limit(300)
    .select('_id');
  due.forEach((w) => enqueueCheck(w._id));
}

/* ------------------------------------ Check ------------------------------------ */

async function recordFailure(watch, result) {
  watch.status = result.state === 'blocked' ? 'blocked' : 'error';
  watch.lastError = result.error || 'Unknown error';
  watch.lastChecked = new Date();
  watch.consecutiveFailures += 1;
  scheduleNext(watch);

  // Outages / CAPTCHAs are reported as a STATUS (never as a content change) - and only once.
  const shouldAlert =
    watch.consecutiveFailures >= FAILURE_ALERT_AFTER && !watch.failureAlerted && hasChannels(watch.notify);
  if (shouldAlert) watch.failureAlerted = true;
  await watch.save();
  broadcast('watch:updated', watchPayload(watch));

  if (shouldAlert) {
    await sendStatusAlert(
      watch,
      `The last ${watch.consecutiveFailures} checks failed (${watch.status}): ${watch.lastError}`
    ).catch((e) => console.error('[alert]', e.message));
  }
}

export async function runCheck(watchId) {
  const watch = await Watch.findById(watchId);
  if (!watch || !watch.active) return;

  // Retries with exponential back-off, only for transient errors (not for blocks/CAPTCHAs: retrying those = hammering)
  let result;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    result = await fetchPage(watch.url, { force: attempt > 0 });
    if (result.state !== 'error') break;
    if (attempt < MAX_RETRIES) await sleep(RETRY_BASE * 2 ** attempt);
  }

  if (result.state !== 'ok') return recordFailure(watch, result);

  let built;
  try {
    built = buildText(result.html, watch);
  } catch (err) {
    return recordFailure(watch, { state: 'error', error: `Could not read the page: ${err.message}` });
  }
  if (built.allMissing) {
    return recordFailure(watch, {
      state: 'error',
      error: 'None of the selected regions were found. The page layout may have changed.'
    });
  }
  if (!built.text) return recordFailure(watch, { state: 'error', error: 'No text left after filtering' });

  const hash = sha256(built.text);
  watch.status = 'ok';
  watch.lastError = '';
  watch.lastChecked = new Date();
  watch.consecutiveFailures = 0;
  watch.failureAlerted = false;

  if (hash === watch.lastHash) {
    // Requirement 3: unchanged hash => no new snapshot
    watch.consecutiveChanges = 0;
    watch.noisy = false;
    watch.rebaseline = false;
    scheduleNext(watch);
    await watch.save();
    broadcast('watch:updated', watchPayload(watch));
    return;
  }

  await handleChange(watch, built.text, hash, result.screenshot);
}

async function decideAlert(watch, snap, diff) {
  const recent = await Snapshot.find({ watch: watch._id }).sort({ createdAt: -1 }).limit(10).select('hash');
  // Core question #3: content that flips between a few states (A/B banners) is not news
  if (recent.some((s) => s.hash === snap.hash)) return { action: 'suppress', reason: 'seen-before' };
  if (watch.noisy) return { action: 'suppress', reason: 'noisy-page' };
  if (diff.ratio < THRESHOLD[watch.sensitivity]) return { action: 'suppress', reason: 'below-sensitivity' };
  if (watch.keywords.length) {
    const added = diff.addedLines.join('\n').toLowerCase();
    if (!watch.keywords.some((k) => added.includes(k.toLowerCase()))) return { action: 'suppress', reason: 'keyword-miss' };
  }
  if (watch.notify.digest) return { action: 'digest', reason: 'digest-mode' };
  if (watch.lastAlertAt && Date.now() - watch.lastAlertAt.getTime() < ALERT_COOLDOWN) {
    return { action: 'digest', reason: 'cooldown' }; // not lost: goes into the next daily digest
  }
  return { action: 'send', reason: '' };
}

async function handleChange(watch, text, hash, screenshot) {
  const prev = await Snapshot.findOne({ watch: watch._id }).sort({ createdAt: -1 });
  const shouldSummarize = Boolean(prev && !watch.rebaseline);
  const snap = new Snapshot({ watch: watch._id, hash, text });

  const rel = `${watch._id}/${snap._id}.png`;
  await fs.mkdir(path.join(SHOT_DIR, String(watch._id)), { recursive: true });
  await fs.writeFile(path.join(SHOT_DIR, rel), screenshot);
  snap.screenshot = rel;

  let send = false;
  if (!prev || watch.rebaseline) {
    snap.summary = prev ? 'New baseline (watch settings changed)' : 'First snapshot (baseline)';
    snap.alert = { status: 'none', reason: prev ? 'rebaseline' : 'baseline' };
    watch.consecutiveChanges = 0;
    watch.noisy = false;
    watch.rebaseline = false;
  } else {
    const diff = computeTextDiff(prev.text, text);
    const fallbackSummary = summarize(diff);
    watch.lastSummary = fallbackSummary;
    snap.stats = { added: diff.addedLines.length, removed: diff.removedLines.length, ratio: diff.ratio };
    watch.lastChanged = new Date();
    watch.consecutiveChanges += 1;
    if (watch.consecutiveChanges >= NOISY_AFTER) watch.noisy = true;

    const decision = await decideAlert(watch, snap, diff);
    if (decision.action === 'suppress') snap.alert = { status: 'suppressed', reason: decision.reason };
    else if (decision.action === 'digest') {
      snap.alert = { status: 'digest', reason: decision.reason };
      snap.digestPending = true;
    } else if (!hasChannels(watch.notify)) snap.alert = { status: 'none', reason: 'no-channels' };
    else {
      snap.alert = { status: 'sent', reason: '', at: new Date() };
      watch.lastAlertAt = new Date();
      send = true;
    }
  }

  watch.lastHash = hash;
  scheduleNext(watch);
  // saved BEFORE sending so a crash can never cause a duplicate alert
  await snap.save();
  await watch.save();
  broadcast('watch:updated', watchPayload(watch, snap.summary || watch.lastSummary));

  if (shouldSummarize) {
    summarizeChange(prev.text, text).then(async (summary) => {
      if (!summary) return;
      await Snapshot.updateOne({ _id: snap._id }, { $set: { summary } });
      const latest = await Watch.findById(watch._id);
      if (latest) {
        latest.lastSummary = summary;
        await latest.save();
        broadcast('watch:updated', watchPayload(latest, summary));
      }
    }).catch((err) => console.error('[summary]', err.message));
  }

  if (send) {
    try {
      const { sent } = await sendChangeAlert(watch, snap);
      await Snapshot.updateOne({ _id: snap._id }, { 'alert.channels': sent });
    } catch (err) {
      console.error('[alert]', err.message);
      await Snapshot.updateOne({ _id: snap._id }, { 'alert.status': 'failed', 'alert.reason': err.message.slice(0, 200) });
    }

  }
  await pruneSnapshots(watch._id);
}

async function pruneSnapshots(watchId) {
  const old = await Snapshot.find({ watch: watchId }).sort({ createdAt: -1 }).skip(MAX_SNAPSHOTS).select('screenshot');
  if (!old.length) return;
  await Promise.all(old.map((s) => (s.screenshot ? fs.rm(path.join(SHOT_DIR, s.screenshot), { force: true }) : null)));
  await Snapshot.deleteMany({ _id: { $in: old.map((s) => s._id) } });
}

/* ------------------------------------ Digest ------------------------------------ */

export async function runDigest() {
  const pending = await Snapshot.find({ digestPending: true }).sort({ createdAt: 1 });
  const byWatch = new Map();
  for (const s of pending) {
    const k = String(s.watch);
    if (!byWatch.has(k)) byWatch.set(k, []);
    byWatch.get(k).push(s);
  }
  let digests = 0;
  for (const [watchId, snaps] of byWatch) {
    const watch = await Watch.findById(watchId);
    let ok = false;
    if (watch && hasChannels(watch.notify)) {
      try {
        await sendDigest(watch, snaps);
        ok = true;
        digests++;
      } catch (err) {
        console.error('[digest]', err.message);
      }
    }
    // only clear the queue if sent (or there is nowhere to send it); failed sends retry tomorrow
    if (ok || !watch || !hasChannels(watch.notify)) {
      await Snapshot.updateMany(
        { _id: { $in: snaps.map((s) => s._id) } },
        { digestPending: false, 'alert.status': ok ? 'sent' : 'none', 'alert.at': new Date() }
      );
    }
  }
  return digests;
}

export function startScheduler() {
  cron.schedule('* * * * *', () => tick().catch((e) => console.error('[tick]', e.message)));
  cron.schedule(process.env.DIGEST_CRON || '0 9 * * *', () => runDigest().catch((e) => console.error('[digest]', e.message)));
  setTimeout(() => tick().catch(() => {}), 3000);
  console.log(`[scheduler] started (concurrency ${CONCURRENCY}, retries ${MAX_RETRIES})`);
}
