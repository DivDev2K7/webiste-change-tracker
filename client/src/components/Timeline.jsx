// Requirement 8: per-page version timeline. Pick any two versions to compare.
import { timeAgo } from '../api';

const DOT = {
  sent: 'bg-brand',
  failed: 'bg-bad',
  digest: 'bg-sky-400'
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
    <ul className="divide-y divide-line">
      {snapshots.map((s) => (
        <li key={s._id} className="flex gap-3 py-3">
          <span className={`mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full ${DOT[s.alert?.status] || 'bg-slate-300'}`} />
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-2">
              <time className="text-sm font-semibold" title={new Date(s.createdAt).toLocaleString()}>
                {new Date(s.createdAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
              </time>
              <span className="shrink-0 text-xs text-muted">{timeAgo(s.createdAt)}</span>
            </div>
            <p className="mt-0.5 line-clamp-2 text-sm text-muted">{s.summary}</p>
            {alertText(s.alert) && <p className="mt-0.5 text-xs text-muted">{alertText(s.alert)}</p>}
            <div className="mt-2 flex gap-4 text-xs text-muted">
              <label className="flex cursor-pointer items-center gap-1.5">
                <input type="radio" name="from" className="accent-brand" checked={from === s._id} onChange={() => onSelect({ from: s._id, to })} />
                From
              </label>
              <label className="flex cursor-pointer items-center gap-1.5">
                <input type="radio" name="to" className="accent-brand" checked={to === s._id} onChange={() => onSelect({ from, to: s._id })} />
                To
              </label>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
