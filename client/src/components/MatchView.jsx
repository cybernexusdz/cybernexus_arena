import { useMemo } from 'react';
import { net } from '../services/net.js';
import { useRoom } from '../context/RoomContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useSettings } from '../context/SettingsContext.jsx';
import GameCanvas from './GameCanvas.jsx';
import ErrorBoundary from './ErrorBoundary.jsx';
import TouchControls from './TouchControls.jsx';
import MatchResults from './MatchResults.jsx';
import ConnectionBadge from './ConnectionBadge.jsx';

export default function MatchView() {
  const { room, result, leaveRoom, status, latency } = useRoom();
  const { user } = useAuth();
  const { settings } = useSettings();
  // The bridge is the React→Phaser contract; a new match (matchId) gets a fresh Phaser instance.
  const bridge = useMemo(() => (room.match ? {
    net, userId: user.id, localSlot: room.fighters.indexOf(user.id), players: room.match.players,
    rules: room.match.rules, settings: { ...settings }, touch: { held: 0, press: 0 },
  } : null), [room.matchId]); // eslint-disable-line react-hooks/exhaustive-deps
  const spectators = room.players.filter((p) => p.role === 'spectator');
  if (!bridge) return null;
  return (
    <div className="match">
      <div className="match-bar">
        <button className="btn btn-small btn-ghost" onClick={() => leaveRoom().catch(() => {})}>Leave</button>
        <span className="chip">{room.name} · {room.code}</span>
        <span className="chip">{bridge.localSlot >= 0 ? `Fighter P${bridge.localSlot + 1}` : 'Spectator'}</span>
        <ConnectionBadge status={status} latency={latency} />
        {spectators.length > 0 && <span className="chip">Queue: {spectators.slice(0, 4).map((p) => p.name).join(' → ')}{spectators.length > 4 ? ' …' : ''}</span>}
      </div>
      <div className="match-field">
        <ErrorBoundary><GameCanvas bridge={bridge} /></ErrorBoundary>
        <TouchControls bridge={bridge} />
        {room.phase === 'results' && result && <MatchResults result={result} />}
      </div>
    </div>
  );
}
