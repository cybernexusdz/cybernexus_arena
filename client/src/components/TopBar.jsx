import { useAuth } from '../context/AuthContext.jsx';
import { useRoom } from '../context/RoomContext.jsx';
import ConnectionBadge from './ConnectionBadge.jsx';

export default function TopBar() {
  const { user, logout } = useAuth();
  const { status, latency, room } = useRoom();
  return (
    <header className="topbar">
      <div className="topbar-brand">
        <img className="brand-logo" src="/assets/logo.svg" alt="" />
        <span className="topbar-brand-name">CYBERNEXUS <b>ARENA</b><small>ONLINE FIGHTING ARENA</small></span>
      </div>
      {status !== 'connected' && <div className="banner-warn" role="status">{status === 'connecting' ? 'Connection lost — reconnecting. Your seat is held for 30 seconds.' : 'Offline.'}</div>}
      <div className="topbar-right">
        <ConnectionBadge status={status} latency={latency} />
        <span className="who">{user.name}{user.guest ? ' (guest)' : ` · ${user.wins}W ${user.losses}L`}</span>
        {!room && <button className="btn btn-ghost" onClick={logout}>Sign out</button>}
      </div>
    </header>
  );
}
