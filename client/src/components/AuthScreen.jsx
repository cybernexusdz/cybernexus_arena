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
    <div className="landing">
      <header className="landing-top">
        <div className="landing-brand"><span className="brand-mark"><i>CN</i></span><span>CYBERNEXUS <b>ARENA</b></span></div>
        <div className="landing-live"><i /> ONLINE FIGHTING ARENA</div>
      </header>
      <main className="auth">
        <section className="auth-hero" aria-labelledby="landing-title">
          <div className="hero-kicker"><span>01</span> THE NEXT ROUND STARTS HERE</div>
          <h1 id="landing-title"><span>STEP INTO</span><strong>CYBERNEXUS</strong><em>ARENA</em></h1>
          <p>Pick your fighter. Find your rivals. Fight for the win.</p>
          <div className="arena-preview" aria-hidden="true">
            <div className="preview-top"><span>LIVE BATTLE SYSTEM</span><span className="preview-signal"><i /> READY</span></div>
            <div className="preview-grid" />
            <div className="preview-fighters">
              <div className="preview-fighter challenger"><span>01</span><small>CHALLENGER</small></div>
              <div className="preview-vs">VS</div>
              <div className="preview-fighter defender"><span>02</span><small>RIVAL</small></div>
            </div>
            <div className="preview-floor"><span>FIGHT<br />ONLINE</span><b>● ● ●</b><span>ROUND 01</span></div>
            <div className="preview-corner corner-left" />
            <div className="preview-corner corner-right" />
          </div>
          <div className="hero-facts">
            <div><b>08</b><span>FIGHTERS<br />PER ROOM</span></div>
            <div><b>01<span>v</span>01</b><span>REAL-TIME<br />BATTLES</span></div>
            <div><b>∞</b><span>REMATCH<br />POTENTIAL</span></div>
          </div>
        </section>
        <form className="panel auth-form" onSubmit={submit}>
          <div className="form-heading">
            <span className="form-eyebrow">{mode === 'guest' ? 'NO ACCOUNT NEEDED' : mode === 'login' ? 'WELCOME BACK, FIGHTER' : 'JOIN THE ROSTER'}</span>
            <h2>{mode === 'guest' ? 'Get in the game.' : mode === 'login' ? 'Return to battle.' : 'Create your account.'}</h2>
            <p>{mode === 'guest' ? 'Jump straight into the arena as a guest.' : mode === 'login' ? 'Sign in to pick up where you left off.' : 'Save your record and claim your name.'}</p>
          </div>
          <div className="tabs" role="tablist" aria-label="Choose how to play">
            {[['guest', 'Guest play'], ['login', 'Sign in'], ['register', 'Create account']].map(([k, l]) => (
              <button type="button" role="tab" aria-selected={mode === k} key={k} className={mode === k ? 'on' : ''} onClick={() => { setMode(k); setError(''); }}>{l}</button>
            ))}
          </div>
          {mode === 'guest' ? (
            <label>FIGHTER NAME <input value={name} onChange={(e) => setName(e.target.value)} maxLength={16} placeholder="Leave blank for a random name" /></label>
          ) : (
            <>
              <label>USERNAME <input value={username} onChange={(e) => setUsername(e.target.value)} maxLength={16} autoComplete="username" required /></label>
              <label>PASSWORD <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} maxLength={72} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required /></label>
            </>
          )}
          {error && <p className="error" role="alert">{error}</p>}
          <button className="btn btn-primary auth-submit" disabled={busy}>{busy ? 'Connecting…' : mode === 'guest' ? 'Enter the arena' : mode === 'login' ? 'Sign in' : 'Create account'}<span aria-hidden="true">↗</span></button>
          <div className="form-foot"><span className="foot-shield">✦</span><small>{mode === 'guest' ? 'Free to play. No download. Guests can play every mode.' : 'Your account keeps your fighter name and win/loss record.'}</small></div>
        </form>
      </main>
      <footer className="landing-footer"><span>CYBERNEXUS ARENA <i>•</i> FIGHT TOGETHER. RISE ABOVE.</span><span>BUILT FOR THE NEXT GENERATION</span></footer>
    </div>
  );
}
