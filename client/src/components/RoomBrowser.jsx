import { useCallback, useEffect, useState } from 'react';
import { useRoom } from '../context/RoomContext.jsx';

export default function RoomBrowser({ onBack }) {
  const { listRooms, joinRoom, status } = useRoom();
  const [rooms, setRooms] = useState(null);
  const refresh = useCallback(() => listRooms().then(setRooms).catch(() => {}), [listRooms]);
  useEffect(() => { // poll while mounted; interval is cleared on unmount
    if (status !== 'connected') return undefined;
    refresh(); const id = setInterval(refresh, 3000); return () => clearInterval(id);
  }, [refresh, status]);

  return (
    <div className="screen">
      <div className="screen-head"><button className="btn btn-ghost" onClick={onBack}>Back</button><h2>Public rooms</h2><button className="btn" onClick={refresh}>Refresh</button></div>
      {rooms === null && <p className="muted">Loading rooms…</p>}
      {rooms?.length === 0 && <div className="panel empty"><p>No public rooms yet.</p><p className="muted">Create one and the first challenger will find it here.</p></div>}
      <ul className="room-list">
        {rooms?.map((r) => (
          <li key={r.code} className="panel room-row">
            <div><b>{r.name}</b><span className="muted"> hosted by {r.host}</span></div>
            <div className="chips">
              <span className={`chip ${r.phase !== 'lobby' ? 'live' : ''}`}>{r.phase === 'lobby' ? 'Lobby' : r.phase === 'match' ? 'Fight in progress' : 'Results'}</span>
              <span className="chip">{r.rotation === 'queue' ? 'Queue rotation' : 'Winner stays'}</span>
              <span className="chip">First to {r.roundsToWin}</span>
              <span className="chip">{r.players}/{r.maxPlayers}</span>
            </div>
            <button className="btn btn-primary" disabled={r.players >= r.maxPlayers} onClick={() => joinRoom(r.code).catch(() => {})}>{r.players >= r.maxPlayers ? 'Full' : r.phase === 'match' ? 'Watch' : 'Join'}</button>
          </li>
        ))}
      </ul>
    </div>
  );
}
