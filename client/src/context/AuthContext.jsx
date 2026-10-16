// OPTIONAL: only active when the server has AUTH_PASSWORD set.
import { createContext, useContext, useEffect, useState } from 'react';
import { api, getToken, setToken } from '../api';

const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

export function AuthProvider({ children }) {
  const [enabled, setEnabled] = useState(false);
  const [ready, setReady] = useState(false);
  const [token, setTok] = useState(getToken());

  useEffect(() => {
    api
      .authStatus()
      .then((s) => setEnabled(Boolean(s.enabled)))
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);

  const login = async (password) => {
    const res = await api.login(password);
    setToken(res.token);
    setTok(res.token || '');
  };
  const logout = () => {
    setToken('');
    setTok('');
  };

  return (
    <AuthCtx.Provider value={{ enabled, ready, authed: !enabled || Boolean(token), login, logout }}>
      {children}
    </AuthCtx.Provider>
  );
}
