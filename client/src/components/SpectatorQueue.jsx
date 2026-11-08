import { CHARACTERS } from '@shared/protocol.js';

export default function SpectatorQueue({ players, meId, hostId, canKick, onKick }) {
  const queue = players.filter((p) => p.role === 'spectator');
  return (
    <section className="panel queue">
      <h3>Spectators <span className="muted">({queue.length}) — in line to fight</span></h3>
      {queue.length === 0 ? <p className="muted">Nobody waiting. Share the room code to fill the queue.</p> : (
        <ol>
          {queue.map((p) => (
            <li key={p.id} className={p.id === meId ? 'me' : ''}>
              <span className="qpos">{p.queuePosition === 1 ? 'NEXT' : `#${p.queuePosition}`}</span>
              <i className="swatch" style={{ background: CHARACTERS.find((c) => c.id === p.character)?.color }} />
              <span className="qname">{p.name}{p.id === meId && ' (you)'}</span>
              <span className={`dot ${p.connected ? 'on' : 'off'}`} title={p.connected ? 'Connected' : 'Disconnected'} />
              {p.id === hostId && <span className="chip host">Host</span>}
              <span className="chip">Spectator</span>
              {canKick && p.id !== meId && <button className="btn btn-small btn-ghost" onClick={() => onKick(p.id)}>Kick</button>}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
