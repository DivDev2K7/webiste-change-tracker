// Requirement 1 + 2: render pages in a headless browser (Puppeteer).
// Also answers core questions #1 (outage/CAPTCHA), #2 (200 users, one fetch) and #4 (don't hammer sites).
import puppeteer from 'puppeteer';
import dns from 'dns/promises';
import net from 'net';
import { HttpError } from '../middlewares/errorHandler.js';

const num = (key, fallback) => {
  const v = process.env[key];
  return v !== undefined && v !== '' && Number.isFinite(Number(v)) ? Number(v) : fallback;
};

const NAV_TIMEOUT = num('NAV_TIMEOUT_SECONDS', 30) * 1000;
const CACHE_TTL = num('PAGE_CACHE_TTL_SECONDS', 120) * 1000; // same URL within this window = one fetch
const MIN_DOMAIN_GAP = num('MIN_DOMAIN_GAP_SECONDS', 5) * 1000; // polite delay between hits on one domain
const DOMAIN_COOLDOWN = num('DOMAIN_COOLDOWN_MINUTES', 10) * 60 * 1000; // pause after 429 / 503
const MAX_SHOT_HEIGHT = 6000;
const VIEWPORT = { width: 1280, height: 800 };
const USER_AGENT =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36 WebsiteChangeDetector/1.0';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ----------------------------- URL safety (SSRF) ----------------------------- */

function isPrivateIp(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    return (
      a === 0 || a === 10 || a === 127 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127)
    );
  }
  if (net.isIPv6(ip)) {
    const l = ip.toLowerCase();
    return (
      l === '::1' || l === '::' || l.startsWith('fc') || l.startsWith('fd') ||
      l.startsWith('fe80') || l.startsWith('::ffff:127.') || l.startsWith('::ffff:10.') ||
      l.startsWith('::ffff:192.168.')
    );
  }
  return true;
}

// The app only monitors PUBLIC pages (spec), so block localhost / private network targets.
// Set ALLOW_PRIVATE_URLS=true only for local testing.
export async function assertPublicUrl(raw) {
  let u;
  try {
    u = new URL(raw);
  } catch {
    throw new HttpError(400, 'Invalid URL');
  }
  if (!['http:', 'https:'].includes(u.protocol)) throw new HttpError(400, 'Only http(s) URLs are allowed');
  if (process.env.ALLOW_PRIVATE_URLS === 'true') return u.toString();

  const host = u.hostname.replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal')) {
    throw new HttpError(400, 'Local addresses are not allowed');
  }
  let addrs;
  if (net.isIP(host)) addrs = [{ address: host }];
  else {
    try {
      addrs = await dns.lookup(host, { all: true });
    } catch {
      throw new HttpError(400, 'Could not resolve that host');
    }
  }
  if (addrs.some((a) => isPrivateIp(a.address))) {
    throw new HttpError(400, 'Private or internal addresses are not allowed');
  }
  return u.toString();
}

/* --------------------------- Per-domain politeness --------------------------- */
// Core question #4: never hammer a site. Requests to one domain are serialised and spaced out.

const lastHit = new Map(); // host -> timestamp of last request
const chains = new Map(); // host -> promise chain (serialises requests per host)
const cooldowns = new Map(); // host -> timestamp until which we leave the host alone

function waitForDomain(host) {
  const prev = chains.get(host) || Promise.resolve();
  const next = prev.then(async () => {
    const wait = (lastHit.get(host) || 0) + MIN_DOMAIN_GAP - Date.now();
    if (wait > 0) await sleep(wait);
    lastHit.set(host, Date.now());
  });
  chains.set(host, next.catch(() => {}));
  return next;
}

/* ------------------------------- Browser pool ------------------------------- */

let browserPromise = null;

async function getBrowser() {
  if (!browserPromise) {
    browserPromise = puppeteer
      .launch({
        headless: true,
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
      })
      .then((browser) => {
        browser.on('disconnected', () => {
          browserPromise = null;
        });
        return browser;
      })
      .catch((err) => {
        browserPromise = null;
        throw err;
      });
  }
  return browserPromise;
}

export async function closeBrowser() {
  if (!browserPromise) return;
  try {
    const b = await browserPromise;
    await b.close();
  } catch {
    /* ignore */
  }
  browserPromise = null;
}

/* --------------------- Core question #1: outage vs CAPTCHA --------------------- */
// A site being down or showing a CAPTCHA/bot wall is NOT a content change.
// We classify the response and the scheduler records a status instead of a snapshot.

const BLOCK_PATTERNS = [
  /g-recaptcha/i, /h-captcha/i, /cf-turnstile/i, /captcha/i,
  /cf-browser-verification|challenge-platform|cf-challenge/i,
  /verify you are (a )?human/i, /are you a robot/i, /unusual traffic/i,
  /access denied/i, /attention required/i, /just a moment\.\.\./i
];

function classify(status, html, text) {
  const looksBlocked = BLOCK_PATTERNS.some((re) => re.test(html.slice(0, 200000)));
  if ([401, 403, 429].includes(status)) return ['blocked', `Blocked by the site (HTTP ${status})`];
  if (status === 503 && looksBlocked) return ['blocked', 'Blocked by a bot-protection challenge (HTTP 503)'];
  if (status >= 400) return ['error', `Site returned HTTP ${status}`];
  // Challenge pages are short; a real page that merely has a CAPTCHA widget is long.
  if (looksBlocked && text.trim().length < 1500) return ['blocked', 'CAPTCHA / bot challenge detected'];
  if (text.trim().length < 20) return ['error', 'Page rendered empty'];
  return ['ok', ''];
}

/* -------------------------------- Rendering -------------------------------- */

async function renderPage(url) {
  const host = new URL(url).hostname;

  const cd = cooldowns.get(host);
  if (cd && cd > Date.now()) {
    return {
      state: 'blocked',
      httpStatus: 429,
      error: `Backing off from ${host} until ${new Date(cd).toLocaleTimeString()} (rate limited earlier)`
    };
  }

  await waitForDomain(host);

  let page;
  try {
    const browser = await getBrowser();
    page = await browser.newPage();
    await page.setViewport(VIEWPORT);
    await page.setUserAgent(USER_AGENT);
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const type = req.resourceType();
      if (type === 'media' || type === 'font') return req.abort();
      if (process.env.ALLOW_PRIVATE_URLS !== 'true') {
        try {
          const h = new URL(req.url()).hostname.replace(/^\[|\]$/g, '');
          if (net.isIP(h) && isPrivateIp(h)) return req.abort();
        } catch {
          /* ignore */
        }
      }
      return req.continue();
    });

    const resp = await page.goto(url, { waitUntil: 'networkidle2', timeout: NAV_TIMEOUT });
    await sleep(1000); // let late JS settle
    const httpStatus = resp ? resp.status() : 0;
    const html = await page.content();
    const text = await page.evaluate(() => (document.body ? document.body.innerText : ''));

    const [kind, reason] = classify(httpStatus, html, text);
    if (kind !== 'ok') {
      if (httpStatus === 429 || httpStatus === 503) {
        const retryAfter = Number(resp?.headers()['retry-after']);
        const wait = Number.isFinite(retryAfter) ? retryAfter * 1000 : 0;
        cooldowns.set(host, Date.now() + Math.max(DOMAIN_COOLDOWN, wait));
      }
      return { state: kind, httpStatus, error: reason };
    }

    const height = await page.evaluate(() =>
      Math.max(document.documentElement.scrollHeight, document.body ? document.body.scrollHeight : 0)
    );
    const screenshot = await page.screenshot({
      type: 'png',
      captureBeyondViewport: true,
      clip: { x: 0, y: 0, width: VIEWPORT.width, height: Math.max(1, Math.min(height, MAX_SHOT_HEIGHT)) }
    });
    return { state: 'ok', httpStatus, html, screenshot: Buffer.from(screenshot), fetchedAt: new Date() };
  } catch (err) {
    const msg = err.name === 'TimeoutError' ? `Timed out after ${NAV_TIMEOUT / 1000}s` : err.message;
    return { state: 'error', error: msg };
  } finally {
    if (page) await page.close().catch(() => {});
  }
}

/* ------------- Core question #2: 200 users watching one URL = 1 fetch ------------- */
// Watches are per-user, but fetching is per-URL:
//  - concurrent callers share one in-flight promise
//  - results are cached for PAGE_CACHE_TTL_SECONDS so near-simultaneous checks reuse them
// Each watch then applies ITS OWN selectors / ignore rules / sensitivity to the shared HTML.

const cache = new Map(); // url -> { at, ttl, result }
const inflight = new Map(); // url -> Promise

export async function fetchPage(url, { force = false } = {}) {
  const hit = cache.get(url);
  if (!force && hit && Date.now() - hit.at < hit.ttl) return hit.result;
  if (inflight.has(url)) return inflight.get(url);

  const p = (async () => {
    try {
      const result = await renderPage(url);
      // failures are cached briefly so a broken site isn't retried 200 times
      cache.set(url, { at: Date.now(), ttl: result.state === 'ok' ? CACHE_TTL : Math.min(CACHE_TTL, 30000), result });
      return result;
    } finally {
      inflight.delete(url);
    }
  })();
  inflight.set(url, p);
  return p;
}

setInterval(() => {
  const now = Date.now();
  for (const [k, v] of cache) if (now - v.at > v.ttl) cache.delete(k);
}, 60000).unref();
