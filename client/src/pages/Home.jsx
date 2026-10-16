import { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { api } from '../api';
import Dashboard from '../components/Dashboard.jsx';
import AddWatchForm from '../components/AddWatchForm.jsx';

export default function Home({ demoTabRef }) {
  const location = useLocation();
  const navigate = useNavigate();
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

  const onTryDemo = useCallback(async () => {
    const demoTab = demoTabRef.current || window.open('about:blank', '_blank');
    demoTabRef.current = null;
    if (!demoTab) {
      setError('Allow pop-ups to open the demo in a new tab.');
      return;
    }
    demoTab.opener = null;
    setDemoBusy(true);
    setError('');
    let openedDemo = false;
    try {
      const { demoUrl } = await api.config();
      if (!demoUrl) throw new Error('The demo URL is not configured on the server.');
      demoTab.location.href = demoUrl;
      openedDemo = true;
      if (!watches.some((watch) => watch.url === demoUrl)) {
        await api.createWatch({ name: 'Demo product page', url: demoUrl, intervalMinutes: 60 });
        load();
      }
    } catch (e) {
      if (!openedDemo) demoTab.close();
      setError(e.message);
    } finally {
      setDemoBusy(false);
    }
  }, [demoTabRef, watches]);

  useEffect(() => {
    const action = location.state?.wcdAction;
    if (action === 'add-watch') {
      setAdding(true);
      window.setTimeout(() => document.getElementById('add-watch-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0);
    } else if (action === 'try-demo') {
      onTryDemo();
    }
    if (action) navigate('/', { replace: true, state: null });
  }, [location.state, navigate, onTryDemo]);

  return (
    <div className="space-y-7">
      {adding && (
        <div className="scroll-mt-32">
          <div className="mb-5 flex items-end justify-between gap-4">
            <div><p className="section-label text-[var(--on-canvas-soft)]">Start a new watch</p><h2 className="mt-2 text-3xl font-normal tracking-[-0.04em]">Add a page</h2></div>
            <button onClick={() => setAdding(false)} className="chip">Close</button>
          </div>
        </div>
      )}

      {adding && (
        <AddWatchForm
          onCreated={() => {
            setAdding(false);
            load();
          }}
        />
      )}

      {error && <p role="alert" className="rounded-2xl border border-rose-200/15 bg-rose-950/20 px-5 py-3 text-sm text-rose-200">{error}</p>}
      {loading ? (
        <p className="text-[var(--on-canvas-soft)]">Loading...</p>
      ) : (
        <Dashboard watches={watches} onCheck={onCheck} onDelete={onDelete} onAdd={() => setAdding(true)} onTryDemo={onTryDemo} demoBusy={demoBusy} />
      )}
    </div>
  );
}
