import { RULE_LIMITS, STAGES } from '@shared/protocol.js';

const FIELDS = [
  ['roundsToWin', 'Rounds to win', 1], ['roundTime', 'Round time (s)', 5], ['maxHealth', 'Health', 10], ['damageMultiplier', 'Damage ×', 0.1],
];
/** Editable for the host (onChange provided), read-only otherwise. */
export default function RulesPanel({ rules, onChange, disabled }) {
  const editable = !!onChange && !disabled;
  const set = (patch) => onChange({ ...rules, ...patch });
  return (
    <div className="rules">
      {FIELDS.map(([k, label, step]) => (
        <label key={k}>{label}
          <input type="number" min={RULE_LIMITS[k][0]} max={RULE_LIMITS[k][1]} step={step} value={rules[k]} disabled={!editable}
            onChange={(e) => e.target.value !== '' && set({ [k]: Number(e.target.value) })} />
        </label>
      ))}
      <label>After a match
        <select value={rules.rotation} disabled={!editable} onChange={(e) => set({ rotation: e.target.value })}>
          <option value="winner-stays">Winner stays on</option>
          <option value="queue">Both rotate out (queue)</option>
        </select>
      </label>
      <label>Stage
        <select value={rules.stage} disabled={!editable} onChange={(e) => set({ stage: e.target.value })}>
          {STAGES.map((s) => <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>)}
        </select>
      </label>
    </div>
  );
}
