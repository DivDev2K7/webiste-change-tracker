import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { api } from '../api';
import Dashboard from '../components/Dashboard.jsx';
import AddWatchForm from '../components/AddWatchForm.jsx';
import { subscribe } from '../lib/socket.js';

export default function Home({ demoTabRef }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [watches, setWatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [demoBusy, setDemoBusy] = useState(false);
  const warnedNoisy = useRef(new Set());
  const handledAction = useRef(null);

  const load = useCallback(() => {
    api
      .listWatches()
      .then((w) => {
        setWatches(w);
        w.forEach((watch) => {
          if (watch.noisy && !warnedNoisy.current.has(watch._id)) {
            toast.warning('This page looks noisy');
            warnedNoisy.current.add(watch._id);
          } else if (!watch.noisy) warnedNoisy.current.delete(watch._id);
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 10000); // keep status and timestamps fresh
    return () => clearInterval(t);
  }, [load]);

  const onCheck = (id) => api.checkWatch(id).then(() => {
    toast.info('Check queued');
    setTimeout(load, 4000);
  }).catch(() => {});

  const onDelete = (w) => {
    if (!window.confirm(`Delete "${w.name}" and all of its saved versions?`)) return;
    api.deleteWatch(w._id).then(() => {
      toast.success('Watch deleted');
      load();
    }).catch(() => {});
  };

  const onTryDemo = useCallback(async () => {
    const demoTab = demoTabRef.current || window.open('about:blank', '_blank');
    demoTabRef.current = null;
    if (!demoTab) {
      toast.error('Allow pop-ups to open the demo in a new tab.');
      return;
    }
    demoTab.opener = null;
    setDemoBusy(true);
    let openedDemo = false;
    try {
      const { demoUrl } = await api.config();
      if (!demoUrl) throw new Error('The demo URL is not configured on the server.');
      demoTab.location.href = demoUrl;
      openedDemo = true;
      if (!watches.some((watch) => watch.url === demoUrl)) {
        await api.createWatch({ name: 'Demo product page', url: demoUrl, intervalMinutes: 60 });
        toast.success('Watch created');
        load();
      }
      toast.success('Demo opened in a new tab');
    } catch (e) {
      if (!openedDemo) demoTab.close();
      if (!e.status) toast.error(e.message, { id: e.message });
    } finally {
      setDemoBusy(false);
    }
  }, [demoTabRef, watches]);

  useEffect(() => {
    const updateWatch = (watch) => {
      const normalized = { ...watch, lastSummary: watch.latestSummary ?? watch.lastSummary };
      setWatches((current) => {
        const exists = current.some((item) => item._id === normalized._id);
        if (!exists) return [normalized, ...current];
        return current.map((item) => item._id === normalized._id ? { ...item, ...normalized } : item);
      });
      if (normalized.noisy && !warnedNoisy.current.has(normalized._id)) {
        toast.warning('This page looks noisy');
        warnedNoisy.current.add(normalized._id);
      } else if (!normalized.noisy) warnedNoisy.current.delete(normalized._id);
    };
    const unsubCreated = subscribe('watch:created', updateWatch);
    const unsubUpdated = subscribe('watch:updated', updateWatch);
    const unsubDeleted = subscribe('watch:deleted', ({ _id }) => setWatches((current) => current.filter((watch) => watch._id !== _id)));
    return () => {
      unsubCreated();
      unsubUpdated();
      unsubDeleted();
    };
  }, []);

  useEffect(() => {
    const action = location.state?.wcdAction;
    const actionId = location.state?.actionId;
    if (!action || actionId === handledAction.current) return;
    handledAction.current = actionId;
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

      {loading ? (
        <p className="text-[var(--on-canvas-soft)]">Loading...</p>
      ) : (
        <Dashboard watches={watches} onCheck={onCheck} onDelete={onDelete} onAdd={() => setAdding(true)} onTryDemo={onTryDemo} demoBusy={demoBusy} />
      )}
    </div>
  );
}
