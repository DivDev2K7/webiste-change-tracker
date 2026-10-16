import { useState } from 'react';
import { Link, NavLink, Route, Routes } from 'react-router-dom';
import Home from './pages/Home.jsx';
import WatchDetails from './pages/WatchDetails.jsx';
import { useAuth } from './context/AuthContext.jsx';

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
    <form onSubmit={submit} className="card mx-auto mt-16 max-w-sm space-y-4 p-7">
      <h1 className="text-xl font-semibold">Sign in</h1>
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Password"
        aria-label="Password"
        className="input"
      />
      {error && <p className="text-sm text-bad">{error}</p>}
      <button className="btn btn-primary w-full">Sign in</button>
    </form>
  );
}

export default function App() {
  const { ready, authed, enabled, logout } = useAuth();
  if (!ready) return null;

  return (
    <div className="min-h-screen">
      <header className="bg-brand text-white">
        <div className="mx-auto flex h-16 max-w-[1180px] items-center gap-10 px-5">
          <Link to="/" className="text-[28px] font-bold leading-none tracking-tight">
            changewatch
          </Link>
          <nav className="text-[16px]">
            <NavLink to="/" end className={({ isActive }) => (isActive ? 'text-white' : 'text-white/80 hover:text-white')}>
              Dashboard
            </NavLink>
          </nav>
          {enabled && authed && (
            <button onClick={logout} className="ml-auto text-sm text-white/85 hover:text-white">
              Sign out
            </button>
          )}
        </div>
      </header>
      <main className="mx-auto max-w-[1180px] px-5 py-8">
        {authed ? (
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/watch/:id" element={<WatchDetails />} />
            <Route path="*" element={<p className="text-muted">Page not found.</p>} />
          </Routes>
        ) : (
          <LoginForm />
        )}
      </main>
    </div>
  );
}
