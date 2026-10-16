// Requirement 4: noise filtering (timestamps, counters, ads, rotating banners, random tokens)
// + a sensitivity setting. Also turns rendered HTML into clean, comparable text.
import * as cheerio from 'cheerio';

// Never meaningful text
const ALWAYS_REMOVE = 'script, style, noscript, template, iframe, svg, canvas, video, audio';

// Ads, carousels, tickers, cookie banners. Applied at "medium" and "low" sensitivity.
const NOISY_SELECTORS = [
  '.ad', '.ads', '.advert', '.advertisement', '.adsbygoogle', 'ins.adsbygoogle',
  '[id^="ad-"]', '[id^="ads-"]', '[id^="google_ads"]', '[class*="advert"]', '[class*="sponsor"]', '[data-ad]',
  '[class*="carousel"]', '[class*="slider"]', '[class*="marquee"]', '[class*="ticker"]', '[class*="rotator"]',
  '[class*="cookie"]', '[id*="cookie"]', '[class*="consent"]'
].join(', ');

const MONTHS = '(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\\.?';

// Always stripped: values that change on every load but carry no meaning
const ALWAYS_NOISE = [
  /\b\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?/g, // ISO datetime
  /\b\d{1,2}:\d{2}(?::\d{2})?\s?(?:am|pm)?\b/gi, // clock times
  /\b\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}\b/g, // 12/10/2026
  new RegExp(`\\b${MONTHS}\\s+\\d{1,2}(?:st|nd|rd|th)?,?\\s+\\d{4}\\b`, 'gi'), // Oct 15, 2026
  new RegExp(`\\b\\d{1,2}(?:st|nd|rd|th)?\\s+${MONTHS}\\s+\\d{4}\\b`, 'gi'), // 15 Oct 2026
  /\b\d+\s*(?:seconds?|minutes?|hours?|days?|weeks?|months?|years?)\s+ago\b/gi, // "5 minutes ago"
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, // UUIDs
  /[A-Za-z0-9+/_-]{32,}={0,2}/g // long random tokens (CSRF, session ids, hashes)
];

// Stripped at "medium" and "low": live counters
const COUNTER_NOISE = [
  /\b[\d,.]+[kKmM]?\s+(?:views?|visits?|visitors?|online|likes?|comments?|shares?|followers?|downloads?|reads?|watching|viewers?)\b/gi,
  /\b(?:views?|visitors?|hits|online now|users online)\s*[:-]?\s*[\d,.]+/gi
];

const BLOCK_TAGS = 'p, div, li, tr, h1, h2, h3, h4, h5, h6, section, article, header, footer, ul, ol, table, blockquote, pre, nav, aside, form';
const MAX_TEXT = 200000;

export function validateSelector(selector) {
  try {
    cheerio.load('<div></div>')(selector);
    return true;
  } catch {
    return false;
  }
}

function cleanLine(line, level) {
  let out = line;
  for (const re of ALWAYS_NOISE) out = out.replace(re, ' ');
  if (level !== 'high') for (const re of COUNTER_NOISE) out = out.replace(re, ' ');
  return out.replace(/\s+/g, ' ').trim();
}

/**
 * Build the comparable text of a page for one watch.
 * @returns {{ text: string, allMissing: boolean, missing: string[] }}
 */
export function buildText(html, { selectors = [], ignoreSelectors = [], sensitivity = 'medium' } = {}) {
  const $ = cheerio.load(html);

  // 1. Which parts of the page do we look at? (visual-picker regions, else the whole body)
  const missing = [];
  let roots = [];
  if (selectors.length) {
    const seen = new Set();
    for (const sel of selectors) {
      const found = $(sel).toArray();
      if (!found.length) missing.push(sel);
      for (const el of found) if (!seen.has(el)) { seen.add(el); roots.push(el); }
    }
  } else {
    roots = [$('body').get(0)].filter(Boolean);
  }
  if (!roots.length) return { text: '', allMissing: selectors.length > 0, missing };

  // 2. Remove noise INSIDE each region (the region itself is what the user chose, so keep it)
  const removeSelector = [ALWAYS_REMOVE, ...(sensitivity === 'high' ? [] : [NOISY_SELECTORS]), ...ignoreSelectors]
    .filter(Boolean)
    .join(', ');

  const pieces = roots.map((root) => {
    const $r = $(root).clone();
    $r.find(removeSelector).remove();
    $r.find('br').replaceWith('\n');
    $r.find(BLOCK_TAGS).append('\n');
    return $r.text();
  });

  // 3. Normalise line by line, strip regex noise, drop empties
  const lines = pieces
    .join('\n')
    .split('\n')
    .map((l) => cleanLine(l, sensitivity))
    .filter(Boolean);

  return { text: lines.join('\n').slice(0, MAX_TEXT), allMissing: false, missing };
}
