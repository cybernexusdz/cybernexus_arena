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
      <div className="menu-intro">
        <span className="screen-eyebrow">ARENA CONTROL // 01</span>
        <h2 className="menu-title">Choose your fight</h2>
        <p>Find a rival, build a room, or tune your arena setup.</p>
      </div>
      <div className="menu-grid">
        <button className="menu-tile hot" disabled={off} onClick={quick}><small>01 // MATCHMAKING</small><b>Quick match</b><span>Jump into the busiest open room</span><i aria-hidden="true">↗</i></button>
        <button className="menu-tile" disabled={off} onClick={() => onNavigate('browse')}><small>02 // DISCOVER</small><b>Room browser</b><span>See who is fighting right now</span><i aria-hidden="true">↗</i></button>
        <button className="menu-tile" disabled={off} onClick={() => onNavigate('create')}><small>03 // HOST</small><b>Create room</b><span>Public or private, your rules</span><i aria-hidden="true">↗</i></button>
        <button className="menu-tile" onClick={() => onNavigate('settings')}><small>04 // CONFIGURE</small><b>Settings</b><span>Sound, effects, controls</span><i aria-hidden="true">↗</i></button>
      </div>
      <form className="panel code-form" onSubmit={join}>
        <div className="code-intro"><span className="screen-eyebrow">DIRECT ACCESS</span><p>Already have a room code?</p></div>
        <label>ROOM CODE
          <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} maxLength={5} placeholder="e.g. K7QM2" aria-label="Room code" />
        </label>
        <button className="btn btn-primary" disabled={off || code.length < 5}>Join</button>
      </form>
    </div>
  );
}
