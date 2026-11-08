import { useState } from 'react';
import { SettingsProvider } from './context/SettingsContext.jsx';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import { RoomProvider, useRoom } from './context/RoomContext.jsx';
import AuthScreen from './components/AuthScreen.jsx';
import TopBar from './components/TopBar.jsx';
import MainMenu from './components/MainMenu.jsx';
import RoomBrowser from './components/RoomBrowser.jsx';
import CreateRoom from './components/CreateRoom.jsx';
import SettingsScreen from './components/SettingsScreen.jsx';
import Lobby from './components/Lobby.jsx';
import MatchView from './components/MatchView.jsx';
import Toasts from './components/Toasts.jsx';

function Shell() {
  const { user, ready } = useAuth();
  const { room } = useRoom();
  const [view, setView] = useState('menu');
  if (!ready) return <div className="splash">CYBERNEXUS ARENA</div>;
  if (!user) return <AuthScreen />;

  let body;
  if (room) body = room.phase === 'lobby' ? <Lobby /> : <MatchView />;
  else if (view === 'browse') body = <RoomBrowser onBack={() => setView('menu')} />;
  else if (view === 'create') body = <CreateRoom onBack={() => setView('menu')} />;
  else if (view === 'settings') body = <SettingsScreen onBack={() => setView('menu')} />;
  else body = <MainMenu onNavigate={setView} />;

  return (
    <div className="app">
      <TopBar />
      <main className="stage">{body}</main>
      <Toasts />
    </div>
  );
}

export default function App() {
  return (
    <SettingsProvider>
      <AuthProvider>
        <RoomProvider>
          <Shell />
        </RoomProvider>
      </AuthProvider>
    </SettingsProvider>
  );
}
