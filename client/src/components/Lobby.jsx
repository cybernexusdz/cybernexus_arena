import { CHARACTERS } from '@shared/protocol.js';
import { useRoom } from '../context/RoomContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import FighterSlot from './FighterSlot.jsx';
import SpectatorQueue from './SpectatorQueue.jsx';
import RulesPanel from './RulesPanel.jsx';

export default function Lobby() {
  const { room, me, setReady, setCharacter, setRules, startMatch, leaveRoom, kick, toast } = useRoom();
  const { user } = useAuth();
  const isHost = room.hostId === user.id;
  const byId = Object.fromEntries(room.players.map((p) => [p.id, p]));
  const [a, b] = room.fighters.map((id) => byId[id]);
  const bothReady = a?.ready && b?.ready && a.connected && b.connected;
  const copy = async () => { try { await navigator.clipboard.writeText(room.code); toast('Room code copied'); } catch { toast(`Room code: ${room.code}`); } };
  const act = (fn) => (...args) => fn(...args).catch(() => {});

  let hint = '';
  if (!a || !b) hint = 'Waiting for a second fighter';
  else if (!bothReady) hint = 'Both fighters must be ready';
  else if (!isHost) hint = 'Waiting for the host to start';

  return (
    <div className="lobby">
      <header className="lobby-head">
        <div>
          <h2>{room.name}</h2>
          <span className="chip">{room.isPrivate ? 'Private' : 'Public'}</span> <span className="chip">{room.players.length}/{room.maxPlayers} players</span>
        </div>
        <button className="code" onClick={copy} title="Copy room code"><small>ROOM CODE</small><b>{room.code}</b></button>
      </header>

      <div className="versus">
        <FighterSlot slot={0} player={a} isMe={a?.id === user.id} canKick={isHost && a && a.id !== user.id} onKick={() => act(kick)(a.id)} />
        <div className="vs">VS</div>
        <FighterSlot slot={1} player={b} isMe={b?.id === user.id} canKick={isHost && b && b.id !== user.id} onKick={() => act(kick)(b.id)} />
      </div>

      <div className="lobby-cols">
        <SpectatorQueue players={room.players} meId={user.id} hostId={room.hostId} canKick={isHost} onKick={act(kick)} />
        <section className="panel">
          <h3>Rules {isHost ? '' : <span className="muted">(host controls)</span>}</h3>
          <RulesPanel rules={room.rules} onChange={isHost ? act(setRules) : undefined} />
          <h3>Your fighter</h3>
          <div className="picker">
            {CHARACTERS.map((c) => (
              <button key={c.id} className={me?.character === c.id ? 'on' : ''} style={{ '--c': c.color }} onClick={act(() => setCharacter(c.id))} aria-pressed={me?.character === c.id}><i />{c.name}</button>
            ))}
          </div>
        </section>
      </div>

      <footer className="actionbar">
        <button className="btn btn-ghost" onClick={act(leaveRoom)}>Leave room</button>
        <span className="muted hint">{hint}</span>
        {me?.role === 'fighter'
          ? <button className={`btn ${me.ready ? '' : 'btn-primary'}`} onClick={act(() => setReady(!me.ready))}>{me.ready ? 'Cancel ready' : "I'm ready"}</button>
          : <span className="chip">You are spectating — #{me?.queuePosition} in line</span>}
        {isHost && <button className="btn btn-hot" disabled={!bothReady} onClick={act(startMatch)}>Start match</button>}
      </footer>
    </div>
  );
}
