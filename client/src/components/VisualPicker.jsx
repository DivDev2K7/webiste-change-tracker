// Requirement 5: pick regions to watch / ignore by clicking on a live preview of the page.
// Selections are saved as CSS selectors.
import { useEffect, useRef, useState } from 'react';
import { previewUrl } from '../api';

function Chips({ title, items, onRemove, tone }) {
  return (
    <div>
      <div className="mb-1.5 text-sm font-semibold">{title}</div>
      {items.length === 0 ? (
        <p className="text-sm text-muted">Nothing selected</p>
      ) : (
        <ul className="space-y-1.5">
          {items.map((s) => (
            <li key={s} className={`flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 font-mono text-xs ${tone}`}>
              <span className="truncate" title={s}>{s}</span>
              <button type="button" onClick={() => onRemove(s)} className="shrink-0 font-sans hover:underline" aria-label={`Remove ${s}`}>
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function VisualPicker({ url, selectors, ignoreSelectors, onChange }) {
  const [mode, setMode] = useState('watch');
  const [loading, setLoading] = useState(true);
  const frame = useRef(null);

  useEffect(() => {
    const onMessage = (e) => {
      if (e.source !== frame.current?.contentWindow || e.data?.type !== 'wcd-pick') return;
      const sel = String(e.data.selector || '');
      if (!sel) return;
      const key = mode === 'watch' ? 'selectors' : 'ignoreSelectors';
      const current = mode === 'watch' ? selectors : ignoreSelectors;
      if (current.includes(sel)) return;
      onChange({ selectors, ignoreSelectors, [key]: [...current, sel] });
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [mode, selectors, ignoreSelectors, onChange]);

  const remove = (key, value) =>
    onChange({ selectors, ignoreSelectors, [key]: (key === 'selectors' ? selectors : ignoreSelectors).filter((s) => s !== value) });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="chip" aria-pressed={mode === 'watch'} onClick={() => setMode('watch')}>
          Click to watch a region
        </button>
        <button type="button" className="chip" aria-pressed={mode === 'ignore'} onClick={() => setMode('ignore')}>
          Click to ignore a region
        </button>
        <span className="text-sm text-muted">With nothing under Watching, the whole page is monitored.</span>
      </div>

      <div className="grid gap-5 md:grid-cols-[1fr_17rem]">
        <div className="relative h-[28rem] overflow-hidden rounded-xl shadow-card">
          {loading && <div className="absolute inset-0 grid place-items-center bg-white/85 text-sm text-muted">Loading preview...</div>}
          <iframe
            ref={frame}
            key={url}
            title="Page preview"
            src={previewUrl(url)}
            sandbox="allow-scripts"
            onLoad={() => setLoading(false)}
            className="h-full w-full bg-white"
          />
        </div>
        <div className="space-y-5">
          <Chips title="Watching" items={selectors} tone="bg-sky-50 text-sky-900" onRemove={(s) => remove('selectors', s)} />
          <Chips title="Ignoring" items={ignoreSelectors} tone="bg-rose-50 text-rose-900" onRemove={(s) => remove('ignoreSelectors', s)} />
        </div>
      </div>
    </div>
  );
}
