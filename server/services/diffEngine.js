// Requirement 6: text diff, highlighted screenshot diff, side-by-side comparison of any two versions.
import { diffLines } from 'diff';
import pixelmatch from 'pixelmatch';
import pngjs from 'pngjs';
import fs from 'fs/promises';

const { PNG } = pngjs;

/** Line-based text diff + stats used for sensitivity and summaries. */
export function computeTextDiff(oldText, newText) {
  // trailing newline so "last line unchanged" isn't reported as a change
  const parts = diffLines(`${oldText}\n`, `${newText}\n`);
  const addedLines = [];
  const removedLines = [];
  let addedChars = 0;
  let removedChars = 0;

  for (const p of parts) {
    const lines = p.value.split('\n').filter((l) => l.trim());
    if (p.added) {
      addedLines.push(...lines);
      addedChars += p.value.length;
    } else if (p.removed) {
      removedLines.push(...lines);
      removedChars += p.value.length;
    }
  }
  const ratio = Math.min(1, (addedChars + removedChars) / Math.max(oldText.length, newText.length, 1));
  return { parts, addedLines, removedLines, ratio };
}

/** Bonus: one-line change summary (rule-based, no AI needed). */
export function summarize({ addedLines, removedLines }) {
  const bits = [];
  if (addedLines.length) bits.push(`${addedLines.length} line${addedLines.length > 1 ? 's' : ''} added`);
  if (removedLines.length) bits.push(`${removedLines.length} line${removedLines.length > 1 ? 's' : ''} removed`);
  if (!bits.length) return 'Content changed';
  const sample = (addedLines[0] || removedLines[0] || '').slice(0, 120);
  return `${bits.join(', ')}${sample ? ` (e.g. "${sample}")` : ''}`;
}

/** Collapse long unchanged runs so the viewer only shows what matters. */
export function toRenderableParts(parts, context = 3) {
  return parts.flatMap((p) => {
    const lines = p.value.replace(/\n$/, '').split('\n');
    if (p.added) return [{ type: 'add', lines }];
    if (p.removed) return [{ type: 'remove', lines }];
    if (lines.length > context * 2 + 2) {
      return [
        { type: 'same', lines: lines.slice(0, context) },
        { type: 'skip', count: lines.length - context * 2 },
        { type: 'same', lines: lines.slice(-context) }
      ];
    }
    return [{ type: 'same', lines }];
  });
}

function padTo(img, width, height) {
  const canvas = new PNG({ width, height });
  canvas.data.fill(255); // opaque white
  PNG.bitblt(img, canvas, 0, 0, img.width, img.height, 0, 0);
  return canvas;
}

/** Writes a PNG with changed pixels highlighted in red. Returns how much of the page changed. */
export async function screenshotDiff(pathA, pathB, outPath) {
  const [bufA, bufB] = await Promise.all([fs.readFile(pathA), fs.readFile(pathB)]);
  const A = PNG.sync.read(bufA);
  const B = PNG.sync.read(bufB);
  const width = Math.max(A.width, B.width);
  const height = Math.max(A.height, B.height);
  const a = padTo(A, width, height);
  const b = padTo(B, width, height);
  const out = new PNG({ width, height });
  const diffPixels = pixelmatch(a.data, b.data, out.data, width, height, { threshold: 0.1, includeAA: false });
  await fs.writeFile(outPath, PNG.sync.write(out));
  return { diffPixels, percent: Number(((diffPixels / (width * height)) * 100).toFixed(2)) };
}
