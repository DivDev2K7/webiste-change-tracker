import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import Dashboard from '../components/Dashboard.jsx';
import AddWatchForm from '../components/AddWatchForm.jsx';

export default function Home() {
  const [watches, setWatches] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);

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
        <Dashboard watches={watches} onCheck={onCheck} onDelete={onDelete} onAdd={() => setAdding(true)} />
      )}
    </div>
  );
}
