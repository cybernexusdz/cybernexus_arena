import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { net } from '../services/net.js';
import { useAuth } from './AuthContext.jsx';

const Ctx = createContext(null);
export const useRoom = () => useContext(Ctx);

export function RoomProvider({ children }) {
  const { user, logout } = useAuth();
  const [room, setRoom] = useState(null);
  const [result, setResult] = useState(null);
  const [status, setStatus] = useState(net.status);
  const [latency, setLatency] = useState(0);
  const [toasts, setToasts] = useState([]);
  const toastId = useRef(0);

  const toast = useCallback((message, kind = 'info') => {
    const id = ++toastId.current;
    setToasts((t) => [...t.slice(-3), { id, message, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  }, []);

  useEffect(() => {
    const offs = [
      net.on('status', setStatus),
      net.on('latency', setLatency),
      net.on('room:state', (r) => { setRoom(r); if (r.phase !== 'results') setResult(null); else if (r.lastResult) setResult(r.lastResult); }),
      net.on('match:result', setResult),
      net.on('room:none', () => { setRoom(null); setResult(null); }),
      net.on('room:left', () => { setRoom(null); setResult(null); }),
      net.on('room:closed', () => { setRoom(null); setResult(null); }),
      net.on('room:kicked', () => { setRoom(null); setResult(null); toast('You were removed from the room by the host.', 'error'); }),
      net.on('room:notice', ({ message }) => toast(message)),
      net.on('room:rotated', ({ fighters }) => toast(`Next fight: ${fighters.filter(Boolean).join(' vs ')}`)),
      net.on('session:replaced', () => { toast('Signed in from another tab or device.', 'error'); logout(); }),
    ];
    return () => offs.forEach((off) => off());
  }, [toast, logout]);

  const run = useCallback(async (event, payload) => {
    try { return await net.request(event, payload); }
    catch (e) { toast(e.message, 'error'); throw e; }
  }, [toast]);

  const actions = useMemo(() => ({
    listRooms: () => net.request('rooms:list').then((r) => r.rooms),
    createRoom: async (opts) => { const r = await run('room:create', opts); setRoom(r.room); },
    joinRoom: async (code) => { const r = await run('room:join', { code }); setRoom(r.room); },
    leaveRoom: () => run('room:leave'),
    setReady: (ready) => run('room:ready', { ready }),
    setCharacter: (character) => run('room:character', { character }),
    setRules: (rules) => run('room:rules', { rules }),
    startMatch: () => run('room:start'),
    continueMatch: () => run('room:continue'),
    kick: (playerId) => run('room:kick', { playerId }),
  }), [run]);

  const me = room?.players.find((p) => p.id === user?.id) || null;
  const value = useMemo(() => ({ room, me, result, status, latency, toasts, toast, ...actions }), [room, me, result, status, latency, toasts, toast, actions]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
