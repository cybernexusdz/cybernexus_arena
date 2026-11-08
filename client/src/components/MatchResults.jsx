import { CHARACTERS } from '@shared/protocol.js';
import { useRoom } from '../context/RoomContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';

const REASONS = { score: 'Won on rounds', forfeit: 'Opponent left the match', timeout: 'Opponent disconnected', kicked: 'Opponent was removed' };
const color = (id) => CHARACTERS.find((c) => c.id === id)?.color;

export default function MatchResults({ result }) {
  const { room, continueMatch, leaveRoom } = useRoom();
  const { user } = useAuth();
  const isHost = room.hostId === user.id;
  const [w0, w1] = result.wins; const winScore = result.winnerSlot === 0 ? w0 : w1, loseScore = result.winnerSlot === 0 ? w1 : w0;
  return (
    <div className="results" role="dialog" aria-label="Match results">
      <div className="panel results-card">
        <h2>{result.winnerId === user.id ? 'Victory' : result.loserId === user.id ? 'Defeat' : 'Match over'}</h2>
        <div className="results-vs">
          <div className="res win" style={{ '--c': color(result.winnerCharacter) }}><small>WINNER</small><b>{result.winnerName}</b></div>
          <div className="res-score">{winScore}<span>–</span>{loseScore}</div>
          <div className="res lose" style={{ '--c': color(result.loserCharacter) }}><small>LOSER</small><b>{result.loserName}</b></div>
        </div>
        <p className="muted">{REASONS[result.reason] || ''} · {result.rounds} round{result.rounds === 1 ? '' : 's'} · {room.rules.rotation === 'queue' ? 'Queue rotation' : 'Winner stays'}</p>
        {result.upNext?.length > 0 && <p className="upnext">Up next: <b>{result.upNext.join('  vs  ')}</b></p>}
        <div className="results-actions">
          <button className="btn btn-ghost" onClick={() => leaveRoom().catch(() => {})}>Leave room</button>
          {isHost ? <button className="btn btn-primary" onClick={() => continueMatch().catch(() => {})}>Continue to lobby</button> : <span className="muted">Returning to the lobby shortly…</span>}
        </div>
      </div>
    </div>
  );
}
