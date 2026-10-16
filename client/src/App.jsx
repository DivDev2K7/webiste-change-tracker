import { useRef, useState } from 'react';
import { Link, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import Home from './pages/Home.jsx';
import WatchDetails from './pages/WatchDetails.jsx';
import { useAuth } from './context/AuthContext.jsx';

function Icon({ name, size = 16 }) {
  const paths = {
    grid: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
    plus: <><path d="M12 5v14M5 12h14" /></>,
    play: <><path d="m9 6 10 6-10 6z" /></>,
    settings: <><path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z" /><path d="m19.4 15 .1.1 1.4 1.1-1.4 2.4-1.7-.6a8 8 0 0 1-1.4.8l-.3 1.8h-2.8l-.3-1.8a8 8 0 0 1-1.4-.8l-1.7.6-1.4-2.4 1.4-1.1a7 7 0 0 1 0-1.7l-1.4-1.1 1.4-2.4 1.7.6a8 8 0 0 1 1.4-.8l.3-1.8h2.8l.3 1.8a8 8 0 0 1 1.4.8l1.7-.6 1.4 2.4-1.4 1.1a7 7 0 0 1 0 1.7Z" /></>,
    logout: <><path d="M10 17l5-5-5-5M15 12H3" /><path d="M12 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6" /></>
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

function LoginForm() {
  const { login } = useAuth();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await login(password);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <form onSubmit={submit} className="card mx-auto mt-32 max-w-sm space-y-5 p-8">
      <p className="section-label">ChangeWatch · Private dashboard</p>
      <h1 className="text-3xl font-normal tracking-[-0.03em]">Welcome back.</h1>
      <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" aria-label="Password" className="input" />
      {error && <p className="text-sm text-bad">{error}</p>}
      <button className="btn btn-primary w-full">Sign in</button>
    </form>
  );
}

export default function App() {
  const { ready, authed, enabled, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const demoTabRef = useRef(null);
  if (!ready) return null;

  const action = (type) => {
    if (type === 'try-demo') {
      demoTabRef.current = window.open('about:blank', '_blank');
      if (demoTabRef.current) demoTabRef.current.opener = null;
    }
    navigate('/', { state: { wcdAction: type, actionId: Date.now() } });
  };

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[var(--canvas)] text-[var(--on-canvas)]">
      <div className="pointer-events-none fixed inset-0 z-0 opacity-40" style={{ backgroundImage: 'radial-gradient(circle, rgba(255,255,255,.45) 1px, transparent 1.5px)', backgroundSize: '97px 113px' }} />
      {authed && (
        <header className="fixed left-1/2 top-6 z-50 -translate-x-1/2">
          <nav aria-label="Main navigation" className="flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] p-2 shadow-2xl backdrop-blur-xl">
            <Link to="/" aria-label="Website Change Detector dashboard" className="mr-1 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white text-[9px] font-semibold tracking-[-0.06em] text-[#2e3328]">WCD</Link>
            <NavLink to="/" end className={({ isActive }) => `flex items-center gap-2 rounded-full px-3 py-2 text-[10px] uppercase tracking-[0.14em] transition-colors sm:px-4 sm:text-xs ${isActive ? 'bg-white text-[#2e3328]' : 'text-white/70 hover:bg-white/5 hover:text-white'}`}>
              <Icon name="grid" /><span>Dashboard</span>
            </NavLink>
            <button type="button" onClick={() => action('add-watch')} className="flex items-center gap-2 rounded-full px-3 py-2 text-[10px] uppercase tracking-[0.14em] text-white/70 transition-colors hover:bg-white/5 hover:text-white sm:px-4 sm:text-xs">
              <Icon name="plus" /><span className="hidden sm:inline">Add watch</span><span className="sm:hidden">Add</span>
            </button>
            <button type="button" onClick={() => action('try-demo')} className="flex items-center gap-2 rounded-full px-3 py-2 text-[10px] uppercase tracking-[0.14em] text-white/70 transition-colors hover:bg-white/5 hover:text-white sm:px-4 sm:text-xs">
              <Icon name="play" /><span>Demo</span>
            </button>
            <div className="relative">
              <button type="button" aria-expanded={settingsOpen} onClick={() => enabled && setSettingsOpen((open) => !open)} className="flex items-center gap-2 rounded-full px-3 py-2 text-[10px] uppercase tracking-[0.14em] text-white/70 transition-colors hover:bg-white/5 hover:text-white sm:px-4 sm:text-xs">
                <Icon name="settings" /><span className="hidden sm:inline">Settings</span>
              </button>
              {settingsOpen && enabled && (
                  <div className="absolute right-0 top-12 rounded-2xl border border-white/10 bg-[#2e3328] p-2 shadow-2xl">
                    <button type="button" onClick={logout} className="flex items-center gap-2 whitespace-nowrap rounded-xl px-3 py-2 text-xs text-white/80 hover:bg-white/10">
                      <Icon name="logout" /> Sign out
                    </button>
                  </div>
              )}
            </div>
          </nav>
        </header>
      )}

      <main className="relative z-10 mx-auto min-h-screen w-full max-w-[1200px] px-6 pb-32 pt-28 md:px-12 md:pt-32">
        {authed ? (
          <div key={location.pathname} className="page-enter">
            <Routes>
              <Route path="/" element={<Home demoTabRef={demoTabRef} />} />
              <Route path="/watch/:id" element={<WatchDetails />} />
              <Route path="*" element={<p className="pt-20 text-center text-[var(--on-canvas-soft)]">Page not found.</p>} />
            </Routes>
          </div>
        ) : <LoginForm />}
      </main>
      {authed && (
        <>
          <div className="fixed bottom-6 left-6 z-40 flex items-center gap-2 rounded-full bg-black/40 px-3 py-2 text-[10px] uppercase tracking-[0.16em] text-white/75 backdrop-blur-xl">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)] shadow-[0_0_10px_var(--accent)]" /> LIVE
          </div>
          <aside aria-hidden="true" className="fixed right-5 top-1/2 z-40 hidden -translate-y-1/2 items-center gap-4 text-[10px] tracking-[0.18em] text-white/45 md:flex">
            <span className="-rotate-90 whitespace-nowrap">SCROLL</span><span className="flex h-16 flex-col justify-between"><i className="h-1 w-1 rounded-full bg-[var(--accent)]" /><i className="h-1 w-1 rounded-full bg-white/35" /><i className="h-1 w-1 rounded-full bg-white/35" /></span>
          </aside>
        </>
      )}
    </div>
  );
}
