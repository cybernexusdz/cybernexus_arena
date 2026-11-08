import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, tokenStore } from '../services/api.js';
import { net } from '../services/net.js';

const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(tokenStore.get());
  const [ready, setReady] = useState(false);

  const logout = useCallback(() => { tokenStore.clear(); setToken(null); setUser(null); net.disconnect(); }, []);

  useEffect(() => { // restore session
    let alive = true;
    (async () => {
      const t = tokenStore.get();
      if (t) { try { const { user: u } = await api.me(t); if (alive) setUser(u); } catch { tokenStore.clear(); if (alive) setToken(null); } }
      if (alive) setReady(true);
    })();
    return () => { alive = false; };
  }, []);

  useEffect(() => { // socket lifecycle follows the session
    if (!user || !token) return undefined;
    net.connect(token);
    const off = net.on('auth:invalid', logout);
    return () => { off(); net.disconnect(); };
  }, [user, token, logout]);

  const accept = useCallback(({ user: u, token: t }) => { tokenStore.set(t); setToken(t); setUser(u); }, []);
  const value = useMemo(() => ({
    user, ready, logout,
    guest: async (name) => accept(await api.guest(name)),
    login: async (u, p) => accept(await api.login(u, p)),
    register: async (u, p) => accept(await api.register(u, p)),
  }), [user, ready, logout, accept]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
