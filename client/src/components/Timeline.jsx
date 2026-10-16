// Requirement 8: per-page version timeline. Pick any two versions to compare.
import { timeAgo } from '../api';

const DOT = {
  sent: 'bg-[var(--accent-soft)]',
  failed: 'bg-rose-700',
  digest: 'bg-amber-600'
};

const REASONS = {
  baseline: 'Baseline',
  rebaseline: 'New baseline',
  'seen-before': 'Seen before, no alert',
  'noisy-page': 'Noisy page, no alert',
  'below-sensitivity': 'Too small, no alert',
  'keyword-miss': 'No keyword match',
  cooldown: 'Added to daily digest',
  'digest-mode': 'Added to daily digest',
  'no-channels': 'No alert channel set'
};

function alertText(a) {
  if (!a) return '';
  if (a.status === 'sent') return 'Alert sent';
  if (a.status === 'failed') return 'Alert failed';
  return REASONS[a.reason] || '';
}

export default function Timeline({ snapshots, from, to, onSelect }) {
  if (!snapshots.length) {
    return <p className="text-sm text-muted">No versions yet. The first one is saved after the first check.</p>;
  }

  return (
    <ul className="ml-1 border-l border-black/10 pl-5">
      {snapshots.map((s) => (
        <li key={s._id} className="relative flex gap-3 border-b border-black/5 py-4 last:border-0">
          <span className={`absolute -left-[25px] top-[22px] h-2 w-2 rounded-full ring-4 ring-[var(--surface)] ${DOT[s.alert?.status] || 'bg-[var(--accent-soft)]'}`} />
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-2">
              <time className="text-sm font-semibold" title={new Date(s.createdAt).toLocaleString()}>
                {new Date(s.createdAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
              </time>
              <span className="shrink-0 text-xs text-muted">{timeAgo(s.createdAt)}</span>
            </div>
            <p className="mt-0.5 line-clamp-2 text-sm text-muted">{s.summary}</p>
            {alertText(s.alert) && <p className="mt-0.5 text-xs text-muted">{alertText(s.alert)}</p>}
            <div className="mt-2 flex gap-4 text-xs text-[var(--ink-soft)]">
              <label className="flex cursor-pointer items-center gap-1.5">
                <input type="radio" name="from" className="accent-[var(--accent-soft)]" checked={from === s._id} onChange={() => onSelect({ from: s._id, to })} />
                From
              </label>
              <label className="flex cursor-pointer items-center gap-1.5">
                <input type="radio" name="to" className="accent-[var(--accent-soft)]" checked={to === s._id} onChange={() => onSelect({ from, to: s._id })} />
                To
              </label>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
