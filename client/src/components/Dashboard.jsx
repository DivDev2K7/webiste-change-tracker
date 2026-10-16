// Requirement 8: dashboard with last checked, last changed and status (OK / error / blocked).
// Laid out like match cards: status line, two key rows, one highlighted result line, quiet footer links.
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { intervalLabel, timeAgo } from '../api';

const STATUS = {
  ok: { label: 'OK', dot: 'bg-ok' },
  error: { label: 'Error', dot: 'bg-bad' },
  blocked: { label: 'Blocked', dot: 'bg-warn' },
  pending: { label: 'Waiting', dot: 'bg-slate-400' }
};

export function StatusLabel({ status, paused }) {
  const s = paused ? { label: 'Paused', dot: 'bg-slate-400' } : STATUS[status] || STATUS.pending;
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
      <span className={`h-2 w-2 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}

const host = (url) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
};

function Note({ w }) {
  if (w.status === 'error') return <p className="line-clamp-2 text-sm text-bad">{w.lastError}</p>;
  if (w.status === 'blocked') return <p className="line-clamp-2 text-sm text-warn">{w.lastError}</p>;
  if (w.noisy) return <p className="text-sm text-warn">Changes on every load. Alerts are paused.</p>;
  if (w.lastSummary) return <p className="line-clamp-2 text-sm text-brand">{w.lastSummary}</p>;
  return <p className="text-sm text-muted">{w.status === 'pending' ? 'Waiting for the first check' : 'No changes yet'}</p>;
}

function WatchCard({ w, onCheck, onDelete }) {
  return (
    <article className="card flex flex-col p-5">
      <div className="flex items-center justify-between gap-3">
        <StatusLabel status={w.status} paused={!w.active} />
        <span className="truncate text-xs text-muted" title={w.url}>
          {intervalLabel(w.intervalMinutes)} &middot; {host(w.url)}
        </span>
      </div>

      <Link to={`/watch/${w._id}`} className="mt-3 truncate text-[18px] font-semibold hover:text-brand">
        {w.name}
      </Link>

      <dl className="mt-3 space-y-1.5">
        <div className="flex items-baseline justify-between">
          <dt className="text-muted">Last checked</dt>
          <dd className="font-semibold">{timeAgo(w.lastChecked)}</dd>
        </div>
        <div className="flex items-baseline justify-between">
          <dt className="text-muted">Last changed</dt>
          <dd className="font-semibold">{w.lastChanged ? timeAgo(w.lastChanged) : 'Never'}</dd>
        </div>
      </dl>

      <div className="mt-4 min-h-[2.6rem]">
        <Note w={w} />
      </div>

      <div className="mt-auto flex items-center gap-5 border-t border-line pt-3 text-sm font-medium">
        <Link to={`/watch/${w._id}`} className="hover:text-brand">
          Open
        </Link>
        <button onClick={() => onCheck(w._id)} className="hover:text-brand">
          Check now
        </button>
        <button onClick={() => onDelete(w)} className="ml-auto font-normal text-muted hover:text-bad">
          Delete
        </button>
      </div>
    </article>
  );
}

const FILTERS = [
  ['all', 'All', () => true],
  ['changed', 'Changed', (w) => Boolean(w.lastChanged)],
  ['attention', 'Needs attention', (w) => w.status === 'error' || w.status === 'blocked' || w.noisy],
  ['paused', 'Paused', (w) => !w.active]
];

export default function Dashboard({ watches, onCheck, onDelete, onAdd }) {
  const [filter, setFilter] = useState('all');

  if (!watches.length) {
    return (
      <div className="py-16 text-center">
        <p className="text-lg font-medium">Nothing is being watched yet</p>
        <p className="mt-1 text-muted">Add a page and the first snapshot is saved within a minute.</p>
        <button onClick={onAdd} className="btn btn-primary mt-5">
          Add a page
        </button>
      </div>
    );
  }

  const active = FILTERS.find((f) => f[0] === filter) || FILTERS[0];
  const shown = watches.filter(active[2]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        {FILTERS.map(([key, label, test]) => {
          const count = watches.filter(test).length;
          if (key !== 'all' && count === 0 && filter !== key) return null;
          return (
            <button key={key} className="chip" aria-pressed={filter === key} onClick={() => setFilter(key)}>
              {label} ({count})
            </button>
          );
        })}
      </div>

      {shown.length === 0 ? (
        <p className="py-10 text-center text-muted">No pages match this filter.</p>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((w) => (
            <WatchCard key={w._id} w={w} onCheck={onCheck} onDelete={onDelete} />
          ))}
        </div>
      )}
    </div>
  );
}
