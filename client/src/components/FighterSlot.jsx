import { CHARACTERS } from '@shared/protocol.js';
import { CHARACTER_ART } from '../game/assets/manifest.js';

export default function FighterSlot({ slot, player, isMe, canKick, onKick }) {
  const char = CHARACTERS.find((c) => c.id === player?.character);
  const portrait = CHARACTER_ART[player?.character]?.portrait;
  return (
    <div className={`slot slot-${slot} ${player ? '' : 'vacant'} ${player?.ready ? 'is-ready' : ''}`} style={char ? { '--c': char.color } : undefined}>
      <div className="slot-tag">P{slot + 1} · FIGHTER</div>
      {player ? (
        <>
          <div className={`slot-portrait slot-portrait-${slot}`} aria-hidden="true">
            {portrait && <img src={portrait} alt="" onError={(event) => { event.currentTarget.hidden = true; }} />}
            <span>{char?.name.slice(0, 1) || '?'}</span>
          </div>
          <div className="slot-name">{player.name}{isMe && <em> (you)</em>}</div>
          <div className="slot-meta">
            <span className={`dot ${player.connected ? 'on' : 'off'}`} title={player.connected ? 'Connected' : 'Disconnected'} />
            {player.isHost && <span className="chip host">Host</span>}
            <span className="chip">{char?.name}</span>
            <span className={`chip ${player.ready ? 'ok' : ''}`}>{!player.connected ? 'Reconnecting…' : player.ready ? 'Ready' : 'Not ready'}</span>
          </div>
          {canKick && <button className="btn btn-small btn-ghost" onClick={onKick}>Kick</button>}
        </>
      ) : <div className="slot-empty">Waiting for a challenger…<small>Next spectator moves up automatically</small></div>}
    </div>
  );
}
