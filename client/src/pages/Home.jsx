import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import Dashboard from '../components/Dashboard.jsx';
import AddWatchForm from '../components/AddWatchForm.jsx';

export default function Home() {
  const [watches, setWatches] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [demoBusy, setDemoBusy] = useState(false);

  const load = useCallback(() => {
    api
      .listWatches()
      .then((w) => {
        setWatches(w);
        setError('');
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 10000); // keep status and timestamps fresh
    return () => clearInterval(t);
  }, [load]);

  const onCheck = (id) =>
    api
      .checkWatch(id)
      .then(() => setTimeout(load, 4000))
      .catch((e) => setError(e.message));

  const onDelete = (w) => {
    if (!window.confirm(`Delete "${w.name}" and all of its saved versions?`)) return;
    api.deleteWatch(w._id).then(load).catch((e) => setError(e.message));
  };

  const onTryDemo = async () => {
    const demoTab = window.open('about:blank', '_blank');
    if (!demoTab) {
      setError('Allow pop-ups to open the demo in a new tab.');
      return;
    }
    demoTab.opener = null;
    setDemoBusy(true);
    setError('');
    try {
      const { demoUrl } = await api.config();
      if (!demoUrl) throw new Error('The demo URL is not configured on the server.');
      demoTab.location.href = demoUrl;
      if (!watches.some((watch) => watch.url === demoUrl)) {
        await api.createWatch({ name: 'Demo product page', url: demoUrl, intervalMinutes: 60 });
        load();
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setDemoBusy(false);
    }
  };

  return (
    <div className="space-y-7">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-[28px] font-semibold tracking-tight">Pages you watch</h1>
        <button onClick={() => setAdding((a) => !a)} className="btn btn-primary">
          {adding ? 'Close' : 'Add a page'}
        </button>
      </div>

      {adding && (
        <AddWatchForm
          onCreated={() => {
            setAdding(false);
            load();
          }}
        />
      )}

      {error && <p className="text-sm text-bad">{error}</p>}
      {loading ? (
        <p className="text-muted">Loading...</p>
      ) : (
        <Dashboard watches={watches} onCheck={onCheck} onDelete={onDelete} onAdd={() => setAdding(true)} onTryDemo={onTryDemo} demoBusy={demoBusy} />
      )}
    </div>
  );
}
