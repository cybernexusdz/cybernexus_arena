import { INPUT } from '@shared/sim.js';

const BTN = [
  ['◀', INPUT.LEFT, false, 'left'], ['▶', INPUT.RIGHT, false, 'right'], ['▲', INPUT.JUMP, false, 'jump'],
  ['🛡', INPUT.BLOCK, false, 'block'], ['👊', INPUT.PUNCH, true, 'punch'], ['🦶', INPUT.KICK, true, 'kick'],
];
/** On-screen controls for touch devices; writes into the bridge's `touch` state read by InputSystem. */
export default function TouchControls({ bridge }) {
  if (bridge.localSlot < 0 || !window.matchMedia('(pointer: coarse)').matches) return null;
  const down = (bit, press) => (e) => { e.preventDefault(); if (press) bridge.touch.press |= bit; else bridge.touch.held |= bit; };
  const up = (bit, press) => (e) => { e.preventDefault(); if (!press) bridge.touch.held &= ~bit; };
  return (
    <div className="touch">
      {BTN.map(([label, bit, press, id]) => (
        <button key={id} className={`t-${id}`} aria-label={id} onPointerDown={down(bit, press)} onPointerUp={up(bit, press)} onPointerCancel={up(bit, press)} onPointerLeave={up(bit, press)} onContextMenu={(e) => e.preventDefault()}>{label}</button>
      ))}
    </div>
  );
}
