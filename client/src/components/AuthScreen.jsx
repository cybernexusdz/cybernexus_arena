import { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';

export default function AuthScreen() {
  const { guest, login, register } = useAuth();
  const [mode, setMode] = useState('guest');
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault(); setError(''); setBusy(true);
    try {
      if (mode === 'guest') await guest(name);
      else if (mode === 'login') await login(username, password);
      else await register(username, password);
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };

  return (
    <div className="auth">
      <section className="auth-hero">
        <h1>CYBERNEXUS<br />ARENA</h1>
        <p>Eight in the room. Two on the mat. Everyone else is next in line.</p>
      </section>
      <form className="panel auth-form" onSubmit={submit}>
        <div className="tabs" role="tablist">
          {[['guest', 'Play as guest'], ['login', 'Sign in'], ['register', 'Create account']].map(([k, l]) => (
            <button type="button" role="tab" aria-selected={mode === k} key={k} className={mode === k ? 'on' : ''} onClick={() => { setMode(k); setError(''); }}>{l}</button>
          ))}
        </div>
        {mode === 'guest' ? (
          <label>Fighter name<input value={name} onChange={(e) => setName(e.target.value)} maxLength={16} placeholder="Leave empty for a random name" autoFocus /></label>
        ) : (
          <>
            <label>Username<input value={username} onChange={(e) => setUsername(e.target.value)} maxLength={16} autoComplete="username" required autoFocus /></label>
            <label>Password<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} maxLength={72} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required /></label>
          </>
        )}
        {error && <p className="error" role="alert">{error}</p>}
        <button className="btn btn-primary" disabled={busy}>{busy ? 'Connecting…' : mode === 'guest' ? 'Enter the arena' : mode === 'login' ? 'Sign in' : 'Create account'}</button>
        {mode === 'guest' && <small className="muted">Guests can play everything. Accounts keep your win/loss record.</small>}
      </form>
    </div>
  );
}
