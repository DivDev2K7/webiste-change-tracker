import { useState } from 'react';
import { Link } from 'react-router-dom';
import { intervalLabel, timeAgo } from '../api';

function Icon({ name, size = 20 }) {
  const paths = {
    stack: <><path d="m12 3 9 5-9 5-9-5 9-5Z" /><path d="m3 12 9 5 9-5M3 16l9 5 9-5" /></>,
    check: <><path d="m5 12 4 4L19 6" /></>,
    change: <><path d="M7 7h11l-3-3M17 17H6l3 3" /><path d="M18 7a7 7 0 0 1 1 8M6 17a7 7 0 0 1-1-8" /></>,
    alert: <><path d="M12 3 2.8 20h18.4L12 3Z" /><path d="M12 9v4m0 3h.01" /></>,
    play: <><path d="m9 6 10 6-10 6z" /></>,
    eye: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></>,
    refresh: <><path d="M20 7v5h-5M4 17v-5h5" /><path d="M5.5 9A7 7 0 0 1 18 6l2 6M4 12l2 6a7 7 0 0 0 12.5-3" /></>,
    trash: <><path d="M3 6h18M8 6V4h8v2m3 0-1 14H6L5 6m4 4v6m6-6v6" /></>,
    sparkle: <><path d="m12 3 1.7 5.3L19 10l-5.3 1.7L12 17l-1.7-5.3L5 10l5.3-1.7L12 3Z" /><path d="m19 16 .8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8L19 16Z" /></>
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

const STATUS = {
  ok: { label: 'Active', className: 'bg-[rgba(122,143,94,.2)] text-[var(--accent-soft)]' },
  pending: { label: 'Pending', className: 'bg-[rgba(122,143,94,.16)] text-[var(--accent-soft)]' },
  error: { label: 'Error', className: 'bg-rose-500/15 text-rose-800' },
  blocked: { label: 'Blocked', className: 'bg-amber-500/20 text-amber-800' }
};

export function StatusLabel({ status, paused }) {
  const current = paused
    ? { label: 'Paused', className: 'bg-black/10 text-[var(--ink-soft)]' }
    : STATUS[status] || STATUS.pending;
  return <span className={`inline-flex items-center rounded-full px-3 py-1 text-[10px] font-medium uppercase tracking-[0.12em] ${current.className}`}>{current.label}</span>;
}

const timeAgoMs = (date) => date ? Date.now() - new Date(date).getTime() : Infinity;

function WatchCard({ w, onCheck, onDelete }) {
  const status = w.noisy
    ? { label: 'Noisy', className: 'bg-amber-500/20 text-amber-800' }
    : !w.active
      ? { label: 'Paused', className: 'bg-black/10 text-[var(--ink-soft)]' }
      : STATUS[w.status] || STATUS.pending;

  return (
    <article className="card group flex min-w-0 flex-col p-6 transition duration-300 ease-out hover:-translate-y-1 hover:bg-[var(--surface-strong)] hover:shadow-[0_32px_70px_-18px_rgba(0,0,0,.45)] md:p-7">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <Link to={`/watch/${w._id}`} title={w.url} className="block truncate text-[18px] font-medium leading-snug tracking-[-0.025em] text-[var(--ink)] hover:text-[var(--accent-soft)]">{w.url}</Link>
          {w.lastSummary && <p className="mt-1 line-clamp-1 text-xs text-[var(--ink-soft)]" title={w.lastSummary}>{w.lastSummary}</p>}
        </div>
        <span className={`shrink-0 rounded-full px-3 py-1 text-[10px] font-medium uppercase tracking-[0.12em] ${status.className}`}>{status.label}</span>
      </div>
      <p className="mt-1 truncate text-sm text-[var(--ink-soft)]" title={w.name}>{w.name}</p>
      <p className="mt-5 line-clamp-2 min-h-12 text-sm leading-relaxed text-[var(--ink-soft)]">
        {w.status === 'error' || w.status === 'blocked' ? w.lastError : w.status === 'pending' ? 'Waiting for the first check' : w.noisy ? 'Changes on every load. Alerts are paused.' : w.lastChanged ? `Last changed ${timeAgo(w.lastChanged).toLowerCase()}` : 'No changes yet'}
      </p>
      <div className="mt-auto flex items-center justify-between gap-3 border-t border-black/5 pt-4">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-[0.13em] text-[var(--ink-soft)]">Last check</p>
          <p className="mt-0.5 truncate text-xs font-medium text-[var(--ink)]">{timeAgo(w.lastChecked)} <span className="font-normal text-[var(--ink-soft)]">· {intervalLabel(w.intervalMinutes)}</span></p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Link to={`/watch/${w._id}`} className="icon-button" aria-label={`View ${w.name}`} title="View"><Icon name="eye" size={16} /></Link>
          <button type="button" onClick={() => onCheck(w._id)} className="icon-button" aria-label={`Check ${w.name} now`} title="Check now"><Icon name="refresh" size={16} /></button>
          <button type="button" onClick={() => onDelete(w)} className="icon-button hover:!text-rose-700" aria-label={`Delete ${w.name}`} title="Delete"><Icon name="trash" size={16} /></button>
        </div>
      </div>
    </article>
  );
}

const FILTERS = [
  ['all', 'All watches', () => true],
  ['changed', 'Changed', (w) => Boolean(w.lastChanged)],
  ['attention', 'Needs attention', (w) => w.status === 'error' || w.status === 'blocked' || w.noisy],
  ['paused', 'Paused', (w) => !w.active]
];

function StatCard({ icon, label, value, delta }) {
  return (
    <article className="card group min-h-48 p-6 transition duration-300 ease-out hover:-translate-y-1 md:p-7">
      <div className="text-[var(--ink-soft)]"><Icon name={icon} /></div>
      <p className="mt-5 text-[10px] font-medium uppercase tracking-[0.16em] text-[var(--ink-soft)]">{label}</p>
      <p className="mt-1 text-5xl font-medium leading-none tracking-[-0.05em] text-[var(--ink)] md:text-[56px]">{value}</p>
      <p className="mt-4 text-xs text-[var(--accent-soft)]">+{delta} this week</p>
    </article>
  );
}

export default function Dashboard({ watches, onCheck, onDelete, onAdd, onTryDemo, demoBusy }) {
  const [filter, setFilter] = useState('all');
  const newThisWeek = watches.filter((w) => timeAgoMs(w.createdAt) <= 7 * 24 * 60 * 60 * 1000).length;
  const activeNewThisWeek = watches.filter((w) => w.active && timeAgoMs(w.createdAt) <= 7 * 24 * 60 * 60 * 1000).length;
  const changedThisWeek = watches.filter((w) => timeAgoMs(w.lastChanged) <= 7 * 24 * 60 * 60 * 1000).length;
  const activeCount = watches.filter((w) => w.active).length;
  const attentionCount = watches.filter((w) => w.status === 'error' || w.status === 'blocked' || w.noisy).length;
  const attentionThisWeek = watches.filter((w) => (w.status === 'error' || w.status === 'blocked' || w.noisy) && timeAgoMs(w.lastChecked) <= 7 * 24 * 60 * 60 * 1000).length;
  const active = FILTERS.find((f) => f[0] === filter) || FILTERS[0];
  const shown = watches.filter(active[2]);

  return (
    <div className="relative space-y-12 md:space-y-16">
      <div className="ambient-hill" />
      <section className="flex flex-col justify-between gap-9 lg:flex-row lg:items-end">
        <div className="max-w-xl">
          <p className="section-label text-[var(--on-canvas-soft)]">Your quiet advantage · {watches.length} pages monitored</p>
          <h1 className="mt-4 text-5xl font-normal leading-[0.98] tracking-[-0.055em] text-[var(--on-canvas)] sm:text-6xl md:text-7xl">Know when<br />the web moves.</h1>
          <p className="mt-5 max-w-md text-sm leading-relaxed text-[var(--on-canvas-soft)]">A thoughtful watchlist for the pages that matter. We’ll keep an eye on every detail.</p>
          <div className="mt-7 flex items-center gap-4">
            <button type="button" onClick={onTryDemo} disabled={demoBusy} className="btn border border-white/20 bg-white/[0.04] px-5 text-[var(--on-canvas)] hover:bg-white/10">
              {demoBusy ? 'Opening demo...' : 'Try the demo'}
            </button>
            <button type="button" onClick={onTryDemo} disabled={demoBusy} aria-label="Play demo" title="Try the demo" className="grid h-16 w-16 shrink-0 place-items-center rounded-full border border-white/20 text-[var(--on-canvas)] transition hover:scale-105 hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:opacity-50">
              <Icon name="play" size={21} />
            </button>
          </div>
        </div>
        <div className="flex items-end justify-between gap-6 lg:justify-end lg:gap-8">
          <div className="rounded-[24px] bg-[var(--surface)] px-6 py-5 text-[22px] font-normal leading-[1.08] tracking-[-0.035em] text-[var(--ink)] shadow-[var(--shadow-card)]">
            Watch.<br />Detect.<br />Notify.
          </div>
          <div className="flex flex-col gap-8 pb-1 text-right">
            <div><p className="text-[9px] uppercase tracking-[0.17em] text-[var(--on-canvas-soft)]">Watches</p><p className="text-3xl font-normal leading-tight tracking-[-0.05em]">{watches.length}</p><p className="text-[10px] text-[var(--on-canvas-soft)]">active</p></div>
            <div><p className="text-[9px] uppercase tracking-[0.17em] text-[var(--on-canvas-soft)]">Changed</p><p className="text-3xl font-normal leading-tight tracking-[-0.05em]">{changedThisWeek}</p><p className="text-[10px] text-[var(--on-canvas-soft)]">this week</p></div>
          </div>
        </div>
      </section>

      <section aria-label="Watchlist statistics" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon="stack" label="All watches" value={watches.length} delta={newThisWeek} />
        <StatCard icon="check" label="Active" value={activeCount} delta={activeNewThisWeek} />
        <StatCard icon="change" label="Pages changed" value={changedThisWeek} delta={changedThisWeek} />
        <StatCard icon="alert" label="Needs attention" value={attentionCount} delta={attentionThisWeek} />
      </section>

      <section className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div><p className="section-label text-[var(--on-canvas-soft)]">Your collection</p><h2 className="mt-2 text-3xl font-normal tracking-[-0.04em] text-[var(--on-canvas)]">Watched pages</h2></div>
          <button type="button" onClick={onAdd} className="btn btn-primary bg-[var(--accent)] text-[var(--ink)] hover:!bg-[#d8ff68]">+ Add a watch</button>
        </div>
        {watches.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {FILTERS.map(([key, label, test]) => {
              const count = watches.filter(test).length;
              if (key !== 'all' && count === 0 && filter !== key) return null;
              return <button key={key} className="chip" aria-pressed={filter === key} onClick={() => setFilter(key)}>{label} ({count})</button>;
            })}
          </div>
        )}
        {watches.length === 0 ? (
          <div className="card relative overflow-hidden px-6 py-14 text-center md:py-20">
            <div className="absolute right-8 top-7 rotate-12 text-[var(--accent-soft)] opacity-60"><Icon name="sparkle" size={28} /></div>
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-white/70 text-[var(--accent-soft)]"><Icon name="eye" size={28} /></div>
            <h3 className="mt-6 text-3xl font-normal tracking-[-0.04em]">A little more peace of mind.</h3>
            <p className="mx-auto mt-2 max-w-md text-sm text-[var(--ink-soft)]">Add a page to your watchlist and we’ll save the first snapshot within a minute.</p>
            <button type="button" onClick={onAdd} className="btn btn-primary mt-6">Add your first watch</button>
          </div>
        ) : shown.length === 0 ? (
          <div className="card px-6 py-12 text-center"><p className="text-lg">Nothing in this view.</p><p className="mt-1 text-sm text-[var(--ink-soft)]">Choose another filter to see your watched pages.</p></div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {shown.map((w) => <WatchCard key={w._id} w={w} onCheck={onCheck} onDelete={onDelete} />)}
          </div>
        )}
      </section>
    </div>
  );
}
