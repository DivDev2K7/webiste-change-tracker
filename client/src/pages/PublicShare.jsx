import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api, intervalLabel, serverAssetUrl, timeAgo } from '../api';
import DiffViewer from '../components/DiffViewer.jsx';
import ScreenshotSlider from '../components/ScreenshotSlider.jsx';
import Timeline from '../components/Timeline.jsx';

export default function PublicShare() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    setData(null);
    setError('');
    api.getSharedWatch(token).then(setData).catch((err) => setError(err.message));
  }, [token]);

  if (error) {
    return <div className="mx-auto max-w-3xl pt-24 text-center"><p className="section-label">Shared watch</p><h1 className="mt-4 text-4xl font-normal tracking-[-0.04em]">This link is unavailable.</h1><p className="mt-3 text-sm text-[var(--on-canvas-soft)]">{error}</p></div>;
  }
  if (!data) return <p className="pt-24 text-center text-[var(--on-canvas-soft)]">Loading shared watch...</p>;

  const { watch, snapshots } = data;
  const latest = snapshots[0];
  const before = snapshots[1];

  return (
    <div className="mx-auto max-w-5xl space-y-9">
      <header className="space-y-4">
        <p className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-[10px] uppercase tracking-[0.15em] text-[var(--on-canvas-soft)]">
          Shared via Website Change Detector
        </p>
        <h1 className="text-5xl font-normal leading-[1.02] tracking-[-0.05em] text-[var(--on-canvas)] md:text-7xl">{watch.name}</h1>
        <a href={watch.url} target="_blank" rel="noreferrer" className="block truncate text-sm text-[var(--on-canvas-soft)] hover:text-[var(--accent)]">{watch.url}</a>
        <p className="text-xs uppercase tracking-[0.12em] text-[var(--on-canvas-soft)]">{intervalLabel(watch.intervalMinutes)} · Last checked {timeAgo(watch.lastChecked).toLowerCase()}</p>
      </header>

      <section className="card p-6 md:p-8">
        <p className="section-label">Recent versions</p>
        <div className="mt-4">
          <Timeline snapshots={snapshots} readOnly />
        </div>
      </section>

      {latest && before && (
        <section className="card space-y-6 p-6 md:p-8">
          <div><p className="section-label">Latest comparison</p><h2 className="mt-2 text-2xl font-medium tracking-[-0.03em]">What changed</h2></div>
          {before.screenshot && latest.screenshot && <ScreenshotSlider beforeUrl={serverAssetUrl(`/screenshots/${before.screenshot}`)} afterUrl={serverAssetUrl(`/screenshots/${latest.screenshot}`)} />}
          <DiffViewer watchId={String(watch._id)} from={String(before._id)} to={String(latest._id)} publicToken={token} showSlider={false} />
        </section>
      )}
    </div>
  );
}
