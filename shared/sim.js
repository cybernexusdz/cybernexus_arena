// Deterministic fighter simulation shared by the authoritative server and the client
// (the client uses it ONLY to predict the local fighter's own movement/animation).
// Units: pixels and seconds, fixed 60 Hz tick. y is the fighter's feet position.
export const TICK_RATE = 60;
export const DT = 1 / TICK_RATE;
export const ARENA = Object.freeze({ width: 960, height: 540, floorY: 470, minX: 50, maxX: 910 });
export const BODY = Object.freeze({ width: 56, height: 130 });
export const INPUT = Object.freeze({ LEFT: 1, RIGHT: 2, JUMP: 4, BLOCK: 8, PUNCH: 16, KICK: 32, SPECIAL: 64, HELD_MASK: 15, ALL: 127 });
export const STATE = Object.freeze({
  IDLE: 'idle', WALK: 'walk', JUMP: 'jump', BLOCK: 'block', PUNCH: 'punch',
  KICK: 'kick', SPECIAL: 'special', HIT: 'hit', BLOCKHIT: 'blockhit', KO: 'ko',
});
export const PHYS = Object.freeze({
  walkSpeed: 270, jumpVelocity: -820, gravity: 2300,
  knockbackDecay: 0.9, inputBufferTicks: 6, minSeparation: 50,
});
// Frame data in ticks. Active window = [startup, startup + active).
export const MOVES = Object.freeze({
  punch: Object.freeze({ startup: 5, active: 3, recovery: 9, damage: 7, reach: 62, high: 112, low: 82, knockback: 200, hitstun: 16, blockstun: 9 }),
  kick: Object.freeze({ startup: 9, active: 4, recovery: 15, damage: 12, reach: 88, high: 72, low: 14, knockback: 360, hitstun: 24, blockstun: 13 }),
});
const special = (name, move) => Object.freeze({ name, cooldown: 6 * TICK_RATE, move: Object.freeze(move) });
export const SPECIAL_MOVES = Object.freeze({
  azure: special('Rising Strike', { startup: 10, active: 3, recovery: 27, damage: 15, reach: 78, high: 126, low: 48, knockback: 300, hitstun: 23, blockstun: 14 }),
  solar: special('Solar Sweep', { startup: 15, active: 5, recovery: 30, damage: 18, reach: 102, high: 85, low: 8, knockback: 370, hitstun: 25, blockstun: 16 }),
  ethan: special('Overdrive Jab', { startup: 8, active: 3, recovery: 25, damage: 13, reach: 92, high: 108, low: 58, knockback: 250, hitstun: 20, blockstun: 12 }),
  ella: special('Crescent Kick', { startup: 13, active: 4, recovery: 29, damage: 16, reach: 96, high: 102, low: 18, knockback: 320, hitstun: 24, blockstun: 15 }),
  dex: special('Shadow Elbow', { startup: 9, active: 3, recovery: 34, damage: 17, reach: 72, high: 114, low: 48, knockback: 420, hitstun: 27, blockstun: 18 }),
  kamal: special('Iron Breaker', { startup: 18, active: 4, recovery: 36, damage: 20, reach: 80, high: 100, low: 34, knockback: 460, hitstun: 30, blockstun: 20 }),
  bachir: special('Sandstorm Hook', { startup: 12, active: 4, recovery: 28, damage: 16, reach: 84, high: 120, low: 54, knockback: 360, hitstun: 25, blockstun: 16 }),
});
export const CHIP_RATIO = 0.15;
export const moveDuration = (m) => m.startup + m.active + m.recovery;

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const r2 = (v) => Math.round(v * 100) / 100;
const setState = (f, s) => { f.state = s; f.frame = 0; };

export function createFighter(slot, x, facing, hp, character = 'azure') {
  return { slot, character, x, y: ARENA.floorY, vx: 0, vy: 0, kx: 0, facing, state: STATE.IDLE, frame: 0, stun: 0, hp, hasHit: false, buffer: null, specialCooldown: 0 };
}
export const cloneFighter = (f) => ({ ...f, buffer: f.buffer ? { ...f.buffer } : null });
export function serializeFighter(f) {
  const o = cloneFighter(f);
  for (const k of ['x', 'y', 'vx', 'vy', 'kx']) o[k] = r2(o[k]);
  return o;
}

function freeControl(f, bits, oppX, grounded) {
  if (oppX != null && grounded) f.facing = oppX >= f.x ? 1 : -1;
  if (grounded && f.buffer) {
    const move = f.buffer.move;
    if (move === STATE.SPECIAL) f.specialCooldown = SPECIAL_MOVES[f.character]?.cooldown ?? SPECIAL_MOVES.azure.cooldown;
    setState(f, move);
    f.hasHit = false; f.vx = 0; f.buffer = null;
    return;
  }
  if (grounded && (bits & INPUT.BLOCK)) { if (f.state !== STATE.BLOCK) setState(f, STATE.BLOCK); f.vx = 0; return; }
  if (!grounded) return; // committed jump: no air control
  const dir = ((bits & INPUT.RIGHT) ? 1 : 0) - ((bits & INPUT.LEFT) ? 1 : 0);
  if (bits & INPUT.JUMP) { f.vy = PHYS.jumpVelocity; f.vx = dir * PHYS.walkSpeed; setState(f, STATE.JUMP); return; }
  f.vx = dir * PHYS.walkSpeed;
  const next = dir ? STATE.WALK : STATE.IDLE;
  if (f.state !== next) setState(f, next);
}

/** Advance one fighter by one tick. `bits` = input bitmask, `oppX` = opponent x (for facing). */
export function stepFighter(f, bits = 0, oppX = null) {
  f.frame++;
  if (f.specialCooldown > 0) f.specialCooldown--;
  if (f.buffer && --f.buffer.ttl <= 0) f.buffer = null;
  if (f.state !== STATE.KO) {
    const press = (bits & INPUT.SPECIAL) && f.specialCooldown === 0 ? STATE.SPECIAL
      : (bits & INPUT.PUNCH) ? STATE.PUNCH
        : (bits & INPUT.KICK) ? STATE.KICK : null;
    if (press) f.buffer = { move: press, ttl: PHYS.inputBufferTicks };
  }
  const grounded = f.y >= ARENA.floorY;
  switch (f.state) {
    case STATE.KO: break;
    case STATE.HIT:
    case STATE.BLOCKHIT:
      f.vx = 0;
      if (--f.stun <= 0) setState(f, grounded ? STATE.IDLE : STATE.JUMP);
      break;
    case STATE.PUNCH:
    case STATE.KICK:
    case STATE.SPECIAL:
      if (f.frame >= moveDuration(getMove(f))) setState(f, STATE.IDLE);
      break;
    default: freeControl(f, bits, oppX, grounded);
  }
  if (f.y < ARENA.floorY || f.vy < 0) f.vy += PHYS.gravity * DT;
  f.y += f.vy * DT;
  if (f.y >= ARENA.floorY) {
    f.y = ARENA.floorY; f.vy = 0;
    if (f.state === STATE.JUMP) { setState(f, STATE.IDLE); f.vx = 0; }
  }
  f.x += (f.vx + f.kx) * DT;
  f.kx *= PHYS.knockbackDecay;
  if (Math.abs(f.kx) < 5) f.kx = 0;
  f.x = clamp(f.x, ARENA.minX, ARENA.maxX);
}

/** Push overlapping grounded fighters apart (server-side only). */
export function separateFighters(a, b) {
  if (Math.abs(a.y - b.y) > 70) return; // one is jumping over the other
  const d = b.x - a.x, ad = Math.abs(d);
  if (ad >= PHYS.minSeparation) return;
  const push = (PHYS.minSeparation - ad) / 2, dir = d >= 0 ? 1 : -1;
  a.x = clamp(a.x - dir * push, ARENA.minX, ARENA.maxX);
  b.x = clamp(b.x + dir * push, ARENA.minX, ARENA.maxX);
}

const getMove = (f) => f.state === STATE.SPECIAL
  ? (SPECIAL_MOVES[f.character]?.move ?? SPECIAL_MOVES.azure.move)
  : MOVES[f.state];
export const isAttacking = (f) => f.state === STATE.PUNCH || f.state === STATE.KICK || f.state === STATE.SPECIAL;
export function getHurtbox(f) {
  return { x1: f.x - BODY.width / 2, x2: f.x + BODY.width / 2, y1: f.y - BODY.height, y2: f.y };
}
export function getHitbox(f) {
  if (!isAttacking(f)) return null;
  const m = getMove(f);
  if (f.frame < m.startup || f.frame >= m.startup + m.active) return null;
  const a = f.x + f.facing * (BODY.width / 2 - 4), b = f.x + f.facing * (BODY.width / 2 + m.reach);
  return { x1: Math.min(a, b), x2: Math.max(a, b), y1: f.y - m.high, y2: f.y - m.low };
}
const overlaps = (a, b) => a.x1 < b.x2 && a.x2 > b.x1 && a.y1 < b.y2 && a.y2 > b.y1;

function applyHit(att, def, move, hb, rules, events) {
  att.hasHit = true;
  const dir = def.x >= att.x ? 1 : -1;
  const base = Math.max(1, Math.round(move.damage * rules.damageMultiplier));
  const blocking = (def.state === STATE.BLOCK || def.state === STATE.BLOCKHIT) && def.facing === (att.x >= def.x ? 1 : -1);
  const pos = { x: Math.round((hb.x1 + hb.x2) / 2), y: Math.round((hb.y1 + hb.y2) / 2) };
  const atWall = def.x <= ARENA.minX + 2 || def.x >= ARENA.maxX - 2;
  if (blocking) {
    const dmg = Math.round(base * CHIP_RATIO);
    def.hp = Math.max(1, def.hp - dmg); // chip damage can never KO
    setState(def, STATE.BLOCKHIT); def.stun = move.blockstun; def.vx = 0; def.kx = dir * move.knockback * 0.5;
    events.push({ type: 'block', attacker: att.slot, defender: def.slot, move: att.state, damage: dmg, ...pos });
  } else {
    def.hp = Math.max(0, def.hp - base);
    setState(def, STATE.HIT); def.stun = move.hitstun; def.vx = 0; def.kx = dir * move.knockback;
    events.push({ type: 'hit', attacker: att.slot, defender: def.slot, move: att.state, damage: base, ...pos });
    if (def.hp <= 0) {
      setState(def, STATE.KO); def.vy = -350; def.kx = dir * move.knockback * 1.4;
      events.push({ type: 'ko', attacker: att.slot, defender: def.slot, ...pos });
    }
  }
  if (atWall) att.kx = -dir * move.knockback * 0.5; // corner pushback
}

/** Resolve hits for this tick. Simultaneous hits trade. Returns events. */
export function resolveCombat(a, b, rules) {
  const hits = [];
  for (const [att, def] of [[a, b], [b, a]]) {
    if (!isAttacking(att) || att.hasHit || def.state === STATE.KO) continue;
    const hb = getHitbox(att);
    if (hb && overlaps(hb, getHurtbox(def))) hits.push([att, def, getMove(att), hb]);
  }
  const events = [];
  for (const [att, def, move, hb] of hits) applyHit(att, def, move, hb, rules, events);
  return events;
}
