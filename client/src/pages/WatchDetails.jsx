import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Share2 } from 'lucide-react';
import { toast } from 'sonner';
import { api, INTERVALS, intervalLabel, timeAgo } from '../api';
import { StatusLabel } from '../components/Dashboard.jsx';
import Timeline from '../components/Timeline.jsx';
import DiffViewer from '../components/DiffViewer.jsx';
import ScreenshotSlider from '../components/ScreenshotSlider.jsx';
import VisualPicker from '../components/VisualPicker.jsx';

function Settings({ watch, onSaved }) {
  const [form, setForm] = useState(() => ({
    intervalMinutes: watch.intervalMinutes,
    sensitivity: watch.sensitivity,
    keywords: (watch.keywords || []).join(', '),
    selectors: watch.selectors || [],
    ignoreSelectors: watch.ignoreSelectors || [],
    email: watch.notify?.email || '',
    discordWebhook: watch.notify?.discordWebhook || '',
    telegramChatId: watch.notify?.telegramChatId || '',
    digest: Boolean(watch.notify?.digest)
  }));
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const save = async () => {
    setError('');
    setInfo('');
    try {
      await api.updateWatch(watch._id, {
        intervalMinutes: Number(form.intervalMinutes),
        sensitivity: form.sensitivity,
        keywords: form.keywords,
        selectors: form.selectors,
        ignoreSelectors: form.ignoreSelectors,
        notify: { email: form.email, discordWebhook: form.discordWebhook, telegramChatId: form.telegramChatId, digest: form.digest }
      });
      setInfo('Saved.');
      toast.success('Settings saved');
      onSaved();
    } catch (e) {
      setError(e.message);
    }
  };

  const sendTest = async () => {
    setError('');
    setInfo('');
    try {
      const r = await api.testAlert({ email: form.email, discordWebhook: form.discordWebhook, telegramChatId: form.telegramChatId });
      setInfo(`Test alert sent via ${r.sent.join(', ')}.`);
      toast.success(`Test alert sent via ${r.sent.join(', ')}.`);
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div className="space-y-8">
      <section className="form-section grid gap-4 md:grid-cols-3">
        <h2 className="section-label md:col-span-3">Watch settings</h2>
        <div>
          <label className="label" htmlFor="s-int">Check</label>
          <select id="s-int" value={form.intervalMinutes} onChange={set('intervalMinutes')} className="input">
            {INTERVALS.map((i) => <option key={i.value} value={i.value}>{i.label}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="s-sens">Alert me about</label>
          <select id="s-sens" value={form.sensitivity} onChange={set('sensitivity')} className="input">
            <option value="high">Every change</option>
            <option value="medium">Meaningful changes</option>
            <option value="low">Only big changes</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="s-kw">Only when these words appear</label>
          <input id="s-kw" placeholder="in stock, discount" value={form.keywords} onChange={set('keywords')} className="input" />
        </div>
      </section>

      <section className="form-section space-y-4">
        <h2 className="section-label">Send alerts to</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <input aria-label="Email" type="email" placeholder="Email address" value={form.email} onChange={set('email')} className="input" />
          <input aria-label="Discord webhook" placeholder="Discord webhook URL" value={form.discordWebhook} onChange={set('discordWebhook')} className="input" />
          <input aria-label="Telegram chat ID" placeholder="Telegram chat ID" value={form.telegramChatId} onChange={set('telegramChatId')} className="input" />
        </div>
        <div className="flex flex-wrap items-center gap-5 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" className="accent-brand" checked={form.digest} onChange={set('digest')} />
            One daily digest instead of instant alerts
          </label>
          <button type="button" onClick={sendTest} className="link">Send a test alert</button>
        </div>
      </section>

      <section className="form-section space-y-4">
        <h2 className="section-label">Regions</h2>
        <VisualPicker
          url={watch.url}
          selectors={form.selectors}
          ignoreSelectors={form.ignoreSelectors}
          onChange={({ selectors, ignoreSelectors }) => setForm((f) => ({ ...f, selectors, ignoreSelectors }))}
        />
        <p className="text-sm text-muted">Changing regions or sensitivity starts a new baseline, so editing never triggers an alert by itself.</p>
      </section>

      {error && <p className="text-sm text-bad">{error}</p>}
      {info && <p className="text-sm text-ok">{info}</p>}
      <button onClick={save} className="btn btn-primary">Save changes</button>
    </div>
  );
}

export default function WatchDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [watch, setWatch] = useState(null);
  const [snaps, setSnaps] = useState([]);
  const [diffData, setDiffData] = useState(null);
  const [tab, setTab] = useState('changes');

  const load = useCallback(() => {
    Promise.all([api.getWatch(id), api.snapshots(id)])
      .then(([w, s]) => {
        setWatch(w);
        setSnaps(s);
      })
      .catch(() => {});
  }, [id]);

  useEffect(() => {
    load();
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
  }, [load]);

  if (!watch) return <p className="pt-20 text-[var(--on-canvas-soft)]">Loading...</p>;

  // default comparison: newest version vs the one before it (or whatever the alert link pointed to)
  const toId = params.get('to') || snaps[0]?._id;
  const toIndex = snaps.findIndex((s) => s._id === toId);
  const fromId = params.get('from') || (toIndex >= 0 ? snaps[toIndex + 1]?._id : undefined);
  const select = ({ from, to }) => setParams({ ...(from ? { from } : {}), ...(to ? { to } : {}) }, { replace: true });

  const checkNow = () => api.checkWatch(id).then(() => {
    toast.info('Check queued');
    setTimeout(load, 4000);
  }).catch(() => {});
  const toggleActive = () => api.updateWatch(id, { active: !watch.active }).then(() => {
    toast.success(watch.active ? 'Watch paused' : 'Watch resumed');
    load();
  }).catch(() => {});
  const remove = () => {
    if (!window.confirm(`Delete "${watch.name}" and all of its saved versions?`)) return;
    api.deleteWatch(id).then(() => {
      toast.success('Watch deleted');
      navigate('/');
    }).catch(() => {});
  };

  const copyLink = async (url) => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Share link copied');
    } catch {
      toast.error('Could not copy the share link');
    }
  };

  const share = async () => {
    try {
      const { token, url } = watch.shareToken
        ? { token: watch.shareToken, url: `${window.location.origin}/share/${watch.shareToken}` }
        : await api.createShare(id);
      setWatch((current) => ({ ...current, shareToken: token }));
      toast('Share link ready', {
        description: url,
        duration: 10000,
        action: { label: 'Copy', onClick: () => copyLink(url) }
      });
    } catch {
      // The API request already reports errors as a toast.
    }
  };

  const firstSaved = snaps.length ? new Date(snaps[snaps.length - 1].createdAt).toLocaleDateString([], { dateStyle: 'medium' }) : '';
  const tabs = [
    ['changes', 'Changes', `${snaps.length} ${snaps.length === 1 ? 'version' : 'versions'}`],
    ['settings', 'Settings', 'Regions and alerts']
  ];

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <Link to="/" className="text-xs uppercase tracking-[0.15em] text-[var(--on-canvas-soft)] hover:text-[var(--accent)]">Dashboard / Watches</Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="pt-2 text-4xl font-normal leading-tight tracking-[-0.045em] text-[var(--on-canvas)] md:text-5xl">{watch.name}</h1>
          {watch.shareToken && <span className="rounded-full border border-[var(--accent)]/20 bg-[var(--accent)]/10 px-3 py-1 text-[10px] uppercase tracking-[0.14em] text-[var(--accent)]">Shared</span>}
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <StatusLabel status={watch.status} paused={!watch.active} />
          <a href={watch.url} target="_blank" rel="noreferrer" className="truncate text-sm text-[var(--on-canvas-soft)] hover:text-[var(--accent)]">{watch.url}</a>
        </div>
        <p className="text-sm text-[var(--on-canvas-soft)]">
          {intervalLabel(watch.intervalMinutes)} &middot; Checked {timeAgo(watch.lastChecked).toLowerCase()} &middot; Changed {watch.lastChanged ? timeAgo(watch.lastChanged).toLowerCase() : 'never'}
        </p>
      </div>

      {watch.status !== 'ok' && watch.lastError && (
        <p className="rounded-2xl border border-amber-200/10 bg-amber-950/20 px-5 py-4 text-sm text-amber-100">
          {watch.lastError}. This is shown as a status and is not counted as a content change.
        </p>
      )}
      {watch.noisy && (
        <p className="rounded-2xl border border-amber-200/10 bg-amber-950/20 px-5 py-4 text-sm text-amber-100">
          This page changed on every recent check, so alerts are paused. Ignore the parts that keep changing, or alert on bigger changes only.
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <button onClick={checkNow} className="btn btn-primary">Check now</button>
        <button onClick={toggleActive} className="btn border border-white/15 bg-white/[0.04] text-[var(--on-canvas)] hover:bg-white/10">{watch.active ? 'Pause' : 'Resume'}</button>
        <button onClick={share} className="btn border border-white/15 bg-white/[0.04] text-[var(--on-canvas)] hover:bg-white/10">
          <Share2 size={17} strokeWidth={1.5} />{watch.shareToken ? 'Copy link' : 'Share'}
        </button>
        <button onClick={remove} className="ml-auto text-xs uppercase tracking-[0.12em] text-[var(--on-canvas-soft)] hover:text-rose-200">Delete this page</button>
      </div>

      <div className="card space-y-7 p-5 md:p-8">
      <div className="flex gap-7 border-b border-line">
        {tabs.map(([key, title, sub]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            aria-pressed={tab === key}
            className={`-mb-px border-b-2 pb-3 text-left ${tab === key ? 'border-brand' : 'border-transparent'}`}
          >
            <div className={`text-[18px] font-medium tracking-[-0.02em] ${tab === key ? 'text-ink' : 'text-muted'}`}>{title}</div>
            <div className="text-sm text-muted">{sub}</div>
          </button>
        ))}
      </div>

      {tab === 'settings' ? (
        <Settings watch={watch} onSaved={load} />
      ) : (
        <>
        {diffData?.from?.screenshot && diffData?.to?.screenshot && (
          <section className="space-y-3">
            <p className="section-label">Before / after</p>
            <ScreenshotSlider beforeUrl={diffData.from.screenshot} afterUrl={diffData.to.screenshot} />
          </section>
        )}
        <div className="grid gap-9 lg:grid-cols-[minmax(0,1fr)_21rem]">
          <section>
            <DiffViewer watchId={id} from={fromId} to={toId} onData={setDiffData} showSlider={false} />
          </section>
          <aside className="lg:border-l lg:border-line lg:pl-8">
            <div className="rounded-[24px] bg-black/[0.035] px-6 py-7 text-center">
              <div className="text-[56px] font-medium leading-none tracking-[-0.05em] text-brand">{snaps.length}</div>
              <p className="mt-3 text-sm font-medium">
                {snaps.length === 1 ? 'version' : 'versions'} saved{firstSaved ? ` since ${firstSaved}` : ''}
              </p>
            </div>
            <h2 className="mb-3 mt-8 text-[20px] font-medium tracking-[-0.025em]">Timeline</h2>
            <Timeline snapshots={snaps} from={fromId} to={toId} onSelect={select} />
          </aside>
        </div>
        </>
      )}
      </div>
    </div>
  );
}
