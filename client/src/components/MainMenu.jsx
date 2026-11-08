import { useState } from 'react';
import { useRoom } from '../context/RoomContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';

export default function MainMenu({ onNavigate }) {
  const { listRooms, joinRoom, createRoom, status } = useRoom();
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState('');

  const quick = async () => {
    setBusy(true);
    try {
      const open = (await listRooms()).filter((r) => r.players < r.maxPlayers).sort((a, b) => b.players - a.players)[0];
      if (open) await joinRoom(open.code); else await createRoom({ name: `${user.name}'s room`, isPrivate: false });
    } catch { /* toast shown by context */ } finally { setBusy(false); }
  };
  const join = async (e) => { e.preventDefault(); setBusy(true); try { await joinRoom(code); } catch { /* toast */ } finally { setBusy(false); } };
  const off = status !== 'connected' || busy;

  return (
    <div className="menu">
      <h2 className="menu-title">Choose your fight</h2>
      <div className="menu-grid">
        <button className="menu-tile hot" disabled={off} onClick={quick}><b>Quick match</b><span>Jump into the busiest open room</span></button>
        <button className="menu-tile" disabled={off} onClick={() => onNavigate('browse')}><b>Room browser</b><span>See who is fighting right now</span></button>
        <button className="menu-tile" disabled={off} onClick={() => onNavigate('create')}><b>Create room</b><span>Public or private, your rules</span></button>
        <button className="menu-tile" onClick={() => onNavigate('settings')}><b>Settings</b><span>Sound, effects, controls</span></button>
      </div>
      <form className="panel code-form" onSubmit={join}>
        <label>Have a room code?
          <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} maxLength={5} placeholder="e.g. K7QM2" aria-label="Room code" />
        </label>
        <button className="btn btn-primary" disabled={off || code.length < 5}>Join</button>
      </form>
    </div>
  );
}
