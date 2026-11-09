// Procedural placeholder fighter: a posed skeleton drawn with Phaser Graphics.
// Angles are absolute, in radians, 0 = pointing down, + = toward the fighter's facing direction.
import { MOVES, SPECIAL_MOVES } from '@shared/sim.js';

const T = 34, S = 34, UA = 24, FA = 24, TORSO = 46;
const lerp = (a, b, t) => a + (b - a) * t;
const pt = (o, a, l) => ({ x: o.x + Math.sin(a) * l, y: o.y + Math.cos(a) * l });
const depth = (a1, a2) => Math.cos(a1) * T + Math.cos(a2) * S;
const envelope = (frame, m) => { // 0 → wind-up/startup, 1 → full extension in active window, back to 0
  if (frame < m.startup) return -0.25 * (frame / m.startup);
  if (frame < m.startup + m.active) return 1;
  return Math.max(0, 1 - (frame - m.startup - m.active) / m.recovery);
};

function pose(state, frame, t, character) {
  const p = { lean: 0.08, crouch: 0, plant: 'both', legF: [0.35, 0.1], legB: [-0.3, -0.05], armF: [0.9, 2.3], armB: [0.5, 2.0], shake: 0 };
  const breathe = Math.sin(t / 220) * 1.5;
  switch (state) {
    case 'idle': p.crouch = breathe + 3; break;
    case 'walk': {
      const s = Math.sin(t / 85);
      p.legF = [0.55 * s, 0.1 + 0.5 * Math.max(0, -s)]; p.legB = [-0.55 * s, 0.1 + 0.5 * Math.max(0, s)];
      p.crouch = Math.abs(s) * 3; p.lean = 0.14; break;
    }
    case 'jump': p.plant = 'air'; p.legF = [0.9, -0.5]; p.legB = [0.3, -1.1]; p.armF = [1.4, 2.4]; p.armB = [-0.6, -0.2]; p.lean = 0.05; break;
    case 'block': p.armF = [1.05, 2.7]; p.armB = [0.85, 2.6]; p.crouch = 9; p.lean = 0.02; break;
    case 'blockhit': p.armF = [1.05, 2.7]; p.armB = [0.85, 2.6]; p.crouch = 9; p.lean = -0.12; p.shake = 3; break;
    case 'punch': {
      const e = envelope(frame, MOVES.punch);
      p.armF = [lerp(0.9, 1.57, e), lerp(2.3, 1.57, e)]; p.armB = [0.2, 2.6]; p.lean = 0.08 + 0.28 * e; p.crouch = 4 + 4 * e;
      p.legF = [0.5 + 0.25 * e, 0.3]; break;
    }
    case 'kick': {
      const e = envelope(frame, MOVES.kick);
      p.plant = 'back'; p.legF = [lerp(0.35, 1.5, e), lerp(-0.2, 1.55, e)]; p.legB = [-0.1, -0.05];
      p.lean = 0.08 - 0.3 * Math.max(e, 0); p.armF = [0.9, 2.3]; p.armB = [-0.9 * Math.max(e, 0), -0.3]; break;
    }
    case 'special': {
      const e = envelope(frame, SPECIAL_MOVES[character]?.move || MOVES.kick);
      p.armF = [lerp(0.9, 1.57, e), lerp(2.3, 1.57, e)];
      p.armB = [lerp(0.5, 1.15, e), lerp(2, 1.65, e)];
      p.lean = 0.08 + 0.4 * e; p.crouch = 5 + 6 * e;
      p.legF = [0.5 + 0.35 * e, 0.3]; break;
    }
    case 'hit': p.lean = -0.5; p.armF = [-0.7, -0.4]; p.armB = [-0.5, 0.2]; p.legF = [0.5, 0.2]; p.legB = [-0.5, -0.1]; p.crouch = 6; p.shake = 2; break;
    case 'ko': p.lean = -0.1; p.armF = [0.6, 0.9]; p.armB = [0.3, 0.6]; p.legF = [0.4, 0.2]; p.legB = [-0.3, -0.2]; break;
    default: break;
  }
  return p;
}

function limb(g, o, a1, a2, l1, l2, color, w) {
  const m = pt(o, a1, l1), e = pt(m, a2, l2);
  g.lineStyle(w, color, 1); g.beginPath(); g.moveTo(o.x, o.y); g.lineTo(m.x, m.y); g.lineTo(e.x, e.y); g.strokePath();
  g.fillStyle(color, 1); g.fillCircle(m.x, m.y, w / 2); g.fillCircle(e.x, e.y, w / 2);
  return e;
}
const shade = (c, k) => ((((c >> 16) & 255) * k) << 16) | ((((c >> 8) & 255) * k) << 8) | ((c & 255) * k);

/** Draw one fighter into Graphics `g` (origin = feet, facing +x). `flash` renders a white hit-flash. */
export function drawRig(g, colors, state, frame, t, flash = false, character) {
  const P = pose(state, frame, t, character);
  const gi = flash ? 0xffffff : colors.gi, pants = flash ? 0xffffff : colors.pants, skin = flash ? 0xffffff : colors.skin;
  const jitter = P.shake ? (Math.random() - 0.5) * P.shake : 0;
  const dF = depth(...P.legF), dB = depth(...P.legB);
  const hipY = P.plant === 'air' ? -58 : -(P.plant === 'back' ? dB : Math.max(dF, dB)) + P.crouch;
  const hip = { x: jitter, y: hipY };
  const sh = { x: hip.x + Math.sin(P.lean) * TORSO, y: hip.y - Math.cos(P.lean) * TORSO };
  const head = { x: sh.x + Math.sin(P.lean) * 20, y: sh.y - Math.cos(P.lean) * 20 };
  const shoulder = { x: sh.x, y: sh.y + 5 };
  g.clear();
  // back limbs (darker)
  const bArm = limb(g, shoulder, P.armB[0], P.armB[1], UA, FA, shade(skin, 0.7), 9);
  const bLeg = limb(g, hip, P.legB[0], P.legB[1], T, S, shade(pants, 0.8), 13);
  g.fillStyle(shade(colors.glove, 0.8), 1); g.fillCircle(bArm.x, bArm.y, 8);
  g.fillStyle(0x10121c, 1); g.fillEllipse(bLeg.x + 4, bLeg.y, 18, 8);
  // torso + hips
  g.lineStyle(24, gi, 1); g.beginPath(); g.moveTo(hip.x, hip.y); g.lineTo(sh.x, sh.y); g.strokePath();
  g.fillStyle(gi, 1); g.fillCircle(sh.x, sh.y, 12);
  g.lineStyle(5, colors.accent, flash ? 0 : 1); g.beginPath(); g.moveTo(hip.x - 11, hip.y - 4); g.lineTo(hip.x + 11, hip.y - 8); g.strokePath(); // belt
  g.fillStyle(pants, 1); g.fillCircle(hip.x, hip.y, 13);
  // front leg
  const fLeg = limb(g, hip, P.legF[0], P.legF[1], T, S, pants, 14);
  g.fillStyle(0x10121c, 1); g.fillEllipse(fLeg.x + 5, fLeg.y, 20, 9);
  // head
  g.fillStyle(skin, 1); g.fillCircle(head.x, head.y, 15);
  g.fillStyle(0x15151f, 1); g.fillRect(head.x - 15, head.y - 17, 30, 9); // hair
  if (!flash) { g.lineStyle(5, colors.accent, 1); g.beginPath(); g.moveTo(head.x - 15, head.y - 5); g.lineTo(head.x + 15, head.y - 5); g.strokePath(); }
  g.fillStyle(0x15151f, 1); g.fillCircle(head.x + 7, head.y + 1, 2.2); // eye
  // front arm + glove
  const fArm = limb(g, shoulder, P.armF[0], P.armF[1], UA, FA, skin, 10);
  g.fillStyle(flash ? 0xffffff : colors.glove, 1); g.fillCircle(fArm.x, fArm.y, 10);
}
