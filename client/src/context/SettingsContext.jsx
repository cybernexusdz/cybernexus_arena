import { createContext, useContext, useEffect, useMemo, useState } from 'react';

const KEY = 'fury.settings';
const DEFAULTS = { volume: 70, shake: true, showPing: true };
const Ctx = createContext(null);
export const useSettings = () => useContext(Ctx);

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(() => {
    try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { return DEFAULTS; }
  });
  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch { /* noop */ } }, [settings]);
  const value = useMemo(() => ({ settings, update: (patch) => setSettings((s) => ({ ...s, ...patch })) }), [settings]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
