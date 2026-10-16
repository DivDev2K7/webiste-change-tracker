# Website Change Detector

A service that watches public web pages and alerts you to **meaningful** changes while ignoring noise (timestamps, counters, ads, rotating banners, random tokens).

Built with **Node.js + Express + MongoDB + Puppeteer** (backend) and **React + Vite + Tailwind** (frontend). 

## How it works

```
 add watch ──► scheduler (every minute) ──► job queue ──► fetchPage(url) ──► per-watch processing
                 finds due watches          concurrency      one shared          noise filter -> text -> SHA-256
                                            timeout, retry   Puppeteer fetch          |
                                                                                      ▼
                    alerts (email / Discord / Telegram) ◄── decide alert ◄── hash changed? ──► save snapshot
                                                          (noise rules)          (text + screenshot)
```

1. The scheduler wakes up every minute and queues watches whose `nextCheckAt` has passed.
2. The queue runs a few checks at a time, each with a timeout and exponential-backoff retries.
3. `scraper.js` renders the page once per URL in headless Chromium and returns HTML + a screenshot.
4. For each watch, `noiseFilter.js` keeps only the chosen regions, strips noise, and produces clean text.
5. The text is hashed (SHA-256). **Only if the hash changed** is a new snapshot (text + screenshot) stored.
6. `scheduler.js` decides whether the change deserves an alert, then `notifier.js` sends it.

## Requirements checklist

| # | Requirement | Where it lives |
|---|---|---|
| 1 | Add URL, name, interval (15 min to 24 h); headless browser | `AddWatchForm.jsx`, `Watch.js` (min 15 / max 1440), `scraper.js` (Puppeteer) |
| 2 | Scheduler + job queue with timeouts and retries; public pages only, no stored credentials | `scheduler.js` (node-cron, queue, timeout, retries), `scraper.js` `assertPublicUrl` |
| 3 | Save page text and screenshot; new snapshot only when content hash changes | `scheduler.js` `runCheck` / `handleChange`, `hash.js`, `Snapshot.js` |
| 4 | Noise filtering (timestamps, counters, ads, banners, tokens) + sensitivity setting | `noiseFilter.js`, sensitivity thresholds in `scheduler.js` |
| 5 | Visual picker for regions to watch / ignore (saved as CSS selectors) | `VisualPicker.jsx`, `previewPage` in `watchController.js` |
| 6 | Text diff, highlighted screenshot diff, side-by-side comparison of any two versions | `diffEngine.js`, `DiffViewer.jsx`, `Timeline.jsx` |
| 7 | Email + Telegram/Discord alerts with summary and diff link; no duplicates; optional daily digest | `notifier.js`, dedupe + digest in `scheduler.js` |
| 8 | Per-page version timeline; dashboard with last checked, last changed, status (OK / error / blocked) | `Timeline.jsx`, `Dashboard.jsx`, `WatchDetails.jsx` |
| Bonus | Keyword-only alerts, one-line change summaries (rule-based, no AI) | `decideAlert` and `summarize` |

Not built (ideas for later): number tracking with charts, AI summaries, browser extension, per-page RSS feed.

## Answers to the 4 core questions

### 1. Is a site outage or CAPTCHA a change?

**No.** `classify()` in `scraper.js` inspects every response before any comparison happens:

- HTTP 401 / 403 / 429, or a short page containing CAPTCHA / bot-challenge markers → status **`blocked`**
- Other 4xx / 5xx, timeouts, empty pages → status **`error`**

Neither creates a snapshot nor is compared with the previous version, so an outage can never look like "the whole page was deleted". The dashboard shows the status instead. Blocked checks are not retried (that would be hammering), and an outage alert is sent only **once**, after 3 failed checks in a row (`FAILURE_ALERT_AFTER`). When the site recovers, the failure counter resets.

### 2. If 200 users watch the same URL, is it fetched 200 times?

**No, once.** Watches are per-user, but fetching is per-URL (`fetchPage()` in `scraper.js`):

- Concurrent requests for the same URL share one in-flight promise.
- The rendered result is cached for `PAGE_CACHE_TTL_SECONDS` (default 120 s), so near-simultaneous checks reuse it.
- The scheduler sorts due watches by URL so they run back-to-back and hit that cache.
- Each watch then applies **its own** selectors, ignore rules and sensitivity to the shared HTML.

### 3. How do we avoid endless alerts on pages that differ on every load?

Several layers, from cheapest to last resort:

1. **Noise filter** strips timestamps, "5 minutes ago", UUIDs, long random tokens, view counters, ads, carousels and cookie banners before hashing.
2. **Visual picker**: the user can ignore any region, or watch only one region.
3. **Sensitivity**: low / medium / high sets how much of the text must change before an alert fires.
4. **Seen-before check**: if the new content matches one of the last 10 versions (e.g. an A/B banner flipping), no alert.
5. **Noisy-page breaker**: if a page changes on 5 checks in a row (`NOISY_AFTER_CHANGES`), it is flagged "changes on every load" and alerts pause until a check finds no change.
6. **Cooldown**: at most one instant alert per watch per 30 minutes; extra changes go into the daily digest, so nothing is lost.
7. Snapshots are capped at 50 per watch, so a noisy page cannot fill the database.

### 4. How do we avoid hammering a site with requests?

- Minimum interval is 15 minutes, enforced on the server.
- Per-domain gate: requests to one domain are serialised with at least `MIN_DOMAIN_GAP_SECONDS` (5 s) between them.
- Global concurrency cap (`QUEUE_CONCURRENCY`, default 2).
- Shared fetch + cache (question 2) means popular URLs cost one request, not many.
- HTTP 429 / 503 puts the whole domain on a cooldown (honouring `Retry-After` when present).
- Failing sites back off exponentially (up to 8x the interval) with random jitter so checks don't all fire at once.
- Manual "Check now" is limited to once per 30 seconds per watch, and reuses the cache.

## Run it

You need Node 20+ and either Docker or a local MongoDB.

### Option A: Docker for MongoDB + backend

```bash
docker compose up            # first start takes a few minutes (installs Chromium)
cd client && npm install && npm run dev
```

Open http://localhost:5173.

### Option B: everything local

```bash
# 1. MongoDB running locally (or use a free MongoDB Atlas URI)
# 2. Backend
cd server
cp ../.env.example .env      # edit MONGO_URI if needed
npm install                  # downloads Chromium for Puppeteer
npm run dev
# 3. Frontend (new terminal)
cd client
npm install
npm run dev
```

Alerts need settings in `.env`: SMTP for email, `TELEGRAM_BOT_TOKEN` for Telegram. Discord only needs a webhook URL pasted into the watch form. Use **Send a test alert** in the form to check your setup.

## Demo

Choose **Try the demo** on the dashboard to open the sample product page and add it to your watches. Use the Admin toggle to edit the product name, price, description, and status; **Save** keeps changes in server memory until the backend restarts, and **Reset** restores the defaults. Set `DEMO_URL` in the server environment to change the URL used by the dashboard (defaults to `http://localhost:5000/demo`).

For local monitoring of the demo, set `ALLOW_PRIVATE_URLS=true` in the server environment. Local URLs are blocked by default by the watcher's SSRF protection; only enable this for local testing.

## API

| Method | Route | Purpose |
|---|---|---|
| GET / POST | `/api/watches` | List / create watches |
| GET / PUT / DELETE | `/api/watches/:id` | Read / update / delete a watch |
| POST | `/api/watches/:id/check` | Queue a check now |
| GET | `/api/watches/:id/snapshots` | Version timeline |
| GET | `/api/watches/:id/diff?from=&to=` | Text diff + screenshot diff of any two versions |
| GET | `/api/watches/preview?url=` | Rendered page + picker script (for the visual picker) |
| GET | `/api/alerts` | Recent alert activity and why alerts were suppressed |
| POST | `/api/alerts/test` | Send a test alert |
| POST | `/api/alerts/digest` | Send the pending daily digest now |
| GET | `/demo` | Public, editable demo product page |
| GET | `/api/config` | Public client configuration, including the demo URL |

## Design decisions worth knowing

- **Public pages only, no stored credentials.** URLs pointing at localhost or private networks are rejected (SSRF protection), and Discord webhooks must be real Discord URLs.
- **Hash of filtered text, not raw HTML.** Raw HTML changes constantly (scripts, tokens); filtered text changes only when a human would see something different.
- **Editing selectors starts a new baseline**, so changing settings never causes a false alert.
- **Snapshot is saved before the alert is sent**, so a crash can't cause duplicate alerts.
- **In-memory queue.** Simple and fine for one server. To scale to several servers, swap `scheduler.js` queue for BullMQ + Redis; the rest of the code stays the same.

## Folder structure

```
server/   Express API, MongoDB models, and the services that do the real work
client/   React dashboard, visual picker, timeline and diff viewer
```
