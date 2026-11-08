import { useSettings } from '../context/SettingsContext.jsx';

export default function SettingsScreen({ onBack }) {
  const { settings, update } = useSettings();
  return (
    <div className="screen">
      <div className="screen-head"><button className="btn btn-ghost" onClick={onBack}>Back</button><h2>Settings</h2><span /></div>
      <div className="panel form-grid">
        <label>Volume: {settings.volume}%<input type="range" min="0" max="100" value={settings.volume} onChange={(e) => update({ volume: Number(e.target.value) })} /></label>
        <label className="check"><input type="checkbox" checked={settings.shake} onChange={(e) => update({ shake: e.target.checked })} /> Screen shake on heavy hits</label>
        <label className="check"><input type="checkbox" checked={settings.showPing} onChange={(e) => update({ showPing: e.target.checked })} /> Show ping in match</label>
        <h3>Controls</h3>
        <dl className="controls">
          <dt>Move</dt><dd>A / D or ← →</dd><dt>Jump</dt><dd>W, ↑ or Space</dd><dt>Block</dt><dd>S, ↓ or Shift (face the attacker)</dd>
          <dt>Punch</dt><dd>J or Z</dd><dt>Kick</dt><dd>K or X</dd><dt>Touch</dt><dd>On-screen buttons appear on touch devices</dd>
        </dl>
      </div>
    </div>
  );
}
