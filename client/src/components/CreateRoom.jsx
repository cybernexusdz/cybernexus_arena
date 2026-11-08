import { useState } from 'react';
import { DEFAULT_RULES } from '@shared/protocol.js';
import { useRoom } from '../context/RoomContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import RulesPanel from './RulesPanel.jsx';

export default function CreateRoom({ onBack }) {
  const { createRoom } = useRoom();
  const { user } = useAuth();
  const [name, setName] = useState(`${user.name}'s room`);
  const [isPrivate, setPrivate] = useState(false);
  const [rules, setRules] = useState({ ...DEFAULT_RULES });
  const [busy, setBusy] = useState(false);
  const submit = async (e) => { e.preventDefault(); setBusy(true); try { await createRoom({ name, isPrivate, rules }); } catch { /* toast */ } finally { setBusy(false); } };
  return (
    <form className="screen" onSubmit={submit}>
      <div className="screen-head"><button type="button" className="btn btn-ghost" onClick={onBack}>Back</button><h2>Create room</h2><span /></div>
      <div className="panel form-grid">
        <label>Room name<input value={name} onChange={(e) => setName(e.target.value)} maxLength={24} required minLength={3} /></label>
        <fieldset className="seg">
          <legend>Visibility</legend>
          <button type="button" className={!isPrivate ? 'on' : ''} onClick={() => setPrivate(false)}>Public — listed in browser</button>
          <button type="button" className={isPrivate ? 'on' : ''} onClick={() => setPrivate(true)}>Private — join by code only</button>
        </fieldset>
        <h3>Match rules</h3>
        <RulesPanel rules={rules} onChange={setRules} />
        <button className="btn btn-primary" disabled={busy}>{busy ? 'Creating…' : 'Create room'}</button>
      </div>
    </form>
  );
}
