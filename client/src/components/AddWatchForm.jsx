// Requirement 1: users add a URL, a name and a check interval (15 min to 24 h).
import { useState } from 'react';
import { api, INTERVALS } from '../api';
import VisualPicker from './VisualPicker.jsx';

const EMPTY = {
  name: '',
  url: '',
  intervalMinutes: 60,
  sensitivity: 'medium',
  keywords: '',
  email: '',
  discordWebhook: '',
  telegramChatId: '',
  digest: false,
  selectors: [],
  ignoreSelectors: []
};

export default function AddWatchForm({ onCreated }) {
  const [form, setForm] = useState(EMPTY);
  const [showPicker, setShowPicker] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  const urlLooksValid = /^https?:\/\/.+\..+/i.test(form.url.trim());

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    setInfo('');
    try {
      await api.createWatch({
        name: form.name,
        url: form.url,
        intervalMinutes: Number(form.intervalMinutes),
        sensitivity: form.sensitivity,
        keywords: form.keywords,
        selectors: form.selectors,
        ignoreSelectors: form.ignoreSelectors,
        notify: { email: form.email, discordWebhook: form.discordWebhook, telegramChatId: form.telegramChatId, digest: form.digest }
      });
      setForm(EMPTY);
      setShowPicker(false);
      onCreated();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const sendTest = async () => {
    setError('');
    setInfo('');
    try {
      const r = await api.testAlert({ email: form.email, discordWebhook: form.discordWebhook, telegramChatId: form.telegramChatId });
      setInfo(`Test alert sent via ${r.sent.join(', ')}.`);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <form id="add-watch-form" onSubmit={submit} className="card scroll-mt-32 space-y-7 p-7 md:p-8">
      <section className="form-section grid gap-5 md:grid-cols-2">
        <h2 className="section-label md:col-span-2">Page details</h2>
        <div>
          <label className="label" htmlFor="url">Page URL</label>
          <input id="url" required type="url" placeholder="https://example.com/pricing" value={form.url} onChange={set('url')} className="input" />
        </div>
        <div>
          <label className="label" htmlFor="name">Name</label>
          <input id="name" placeholder="Pricing page" value={form.name} onChange={set('name')} className="input" />
        </div>
        <div>
          <label className="label" htmlFor="interval">Check</label>
          <select id="interval" value={form.intervalMinutes} onChange={set('intervalMinutes')} className="input">
            {INTERVALS.map((i) => (
              <option key={i.value} value={i.value}>{i.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="sens">Alert me about</label>
          <select id="sens" value={form.sensitivity} onChange={set('sensitivity')} className="input">
            <option value="high">Every change</option>
            <option value="medium">Meaningful changes</option>
            <option value="low">Only big changes</option>
          </select>
        </div>
        <div className="md:col-span-2">
          <label className="label" htmlFor="kw">Only when these words appear (optional, comma separated)</label>
          <input id="kw" placeholder="in stock, discount" value={form.keywords} onChange={set('keywords')} className="input" />
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
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="section-label">Regions</h2>
          <button type="button" disabled={!urlLooksValid} onClick={() => setShowPicker((s) => !s)} className="btn btn-quiet">
            {showPicker ? 'Hide preview' : 'Choose on the page'}
          </button>
          {!showPicker && (form.selectors.length > 0 || form.ignoreSelectors.length > 0) && (
            <span className="text-sm text-muted">{form.selectors.length} watched, {form.ignoreSelectors.length} ignored</span>
          )}
        </div>
        {showPicker && urlLooksValid && (
          <VisualPicker
            url={form.url.trim()}
            selectors={form.selectors}
            ignoreSelectors={form.ignoreSelectors}
            onChange={({ selectors, ignoreSelectors }) => setForm((f) => ({ ...f, selectors, ignoreSelectors }))}
          />
        )}
      </section>

      {error && <p className="text-sm text-bad">{error}</p>}
      {info && <p className="text-sm text-ok">{info}</p>}

      <button disabled={busy} className="btn btn-primary">
        {busy ? 'Adding...' : 'Start watching'}
      </button>
    </form>
  );
}
