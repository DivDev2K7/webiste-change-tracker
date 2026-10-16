// Requirement 6: text diff, highlighted screenshot diff, and side-by-side comparison of any two versions.
import { useEffect, useState } from 'react';
import { api } from '../api';

const TINT = {
  add: 'bg-emerald-50 text-emerald-900',
  remove: 'bg-rose-50 text-rose-900',
  same: 'text-muted',
  skip: 'text-slate-400 italic'
};
const MARK = { add: '+', remove: '-', same: ' ' };

const when = (d) => new Date(d).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });

function Skip({ count }) {
  return <div className={TINT.skip}>... {count} unchanged lines ...</div>;
}

function TextDiff({ parts }) {
  return (
    <div className="overflow-x-auto rounded-xl bg-slate-50 p-4 font-mono text-[13px] leading-6">
      {parts.map((p, i) =>
        p.type === 'skip' ? (
          <Skip key={i} count={p.count} />
        ) : (
          p.lines.map((l, j) => (
            <div key={`${i}-${j}`} className={`whitespace-pre-wrap rounded px-1 ${TINT[p.type]}`}>
              {MARK[p.type]} {l}
            </div>
          ))
        )
      )}
    </div>
  );
}

function Column({ title, parts, hide }) {
  return (
    <div className="min-w-0">
      <h3 className="mb-2 text-sm font-semibold">{title}</h3>
      <div className="overflow-x-auto rounded-xl bg-slate-50 p-4 font-mono text-[13px] leading-6">
        {parts
          .filter((p) => p.type !== hide)
          .map((p, i) =>
            p.type === 'skip' ? (
              <Skip key={i} count={p.count} />
            ) : (
              p.lines.map((l, j) => (
                <div key={`${i}-${j}`} className={`whitespace-pre-wrap rounded px-1 ${TINT[p.type]}`}>
                  {l}
                </div>
              ))
            )
          )}
      </div>
    </div>
  );
}

function Shot({ s }) {
  return s.screenshot ? (
    <img src={s.screenshot} alt="Page screenshot" className="w-full rounded-xl shadow-card" />
  ) : (
    <p className="text-sm text-muted">No screenshot saved.</p>
  );
}

function SideBySide({ data }) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <Column title={`Before, ${when(data.from.createdAt)}`} parts={data.parts} hide="add" />
        <Column title={`After, ${when(data.to.createdAt)}`} parts={data.parts} hide="remove" />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Shot s={data.from} />
        <Shot s={data.to} />
      </div>
    </div>
  );
}

function ShotDiff({ data }) {
  if (!data.screenshotDiff) return <p className="text-muted">A screenshot comparison is not available for these versions.</p>;
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">
        <span className="font-semibold text-ink">{data.screenshotDiff.percent}%</span> of the page changed. Changes are marked in red.
      </p>
      <img src={data.screenshotDiff.url} alt="Highlighted screenshot differences" className="w-full rounded-xl shadow-card" />
    </div>
  );
}

export default function DiffViewer({ watchId, from, to }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('text');

  useEffect(() => {
    setData(null);
    setError('');
    if (!from || !to || from === to) return;
    api.diff(watchId, from, to).then(setData).catch((e) => setError(e.message));
  }, [watchId, from, to]);

  if (!from || !to) return <p className="text-muted">Pick two versions in the timeline to compare them. The first check only saves a baseline.</p>;
  if (from === to) return <p className="text-muted">Choose two different versions to compare.</p>;
  if (error) return <p className="text-bad">{error}</p>;
  if (!data) return <p className="text-muted">Loading comparison...</p>;

  const tabs = [['text', 'Text diff'], ['side', 'Side by side'], ['shot', 'Screenshot diff']];
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {tabs.map(([key, name]) => (
            <button key={key} className="chip" aria-pressed={tab === key} onClick={() => setTab(key)}>
              {name}
            </button>
          ))}
        </div>
        <span className="text-sm text-muted">
          {data.stats.added} added, {data.stats.removed} removed
        </span>
      </div>
      {tab === 'text' && <TextDiff parts={data.parts} />}
      {tab === 'side' && <SideBySide data={data} />}
      {tab === 'shot' && <ShotDiff data={data} />}
    </div>
  );
}
