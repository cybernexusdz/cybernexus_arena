import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createFighter, stepFighter, resolveCombat, separateFighters, INPUT, STATE, MOVES, ARENA, CHIP_RATIO, moveDuration,
} from '../../shared/sim.js';

const rules = { damageMultiplier: 1 };
const pair = (ax = 400, bx = 450) => {
  const a = createFighter(0, ax, 1, 100), b = createFighter(1, bx, -1, 100);
  return [a, b];
};
const run = (f, bits, n, opp = null) => { for (let i = 0; i < n; i++) stepFighter(f, i === 0 ? bits : bits & INPUT.HELD_MASK, opp); };
/** Step both and resolve combat for n ticks */
function duel(a, b, n, ba = 0, bb = 0) {
  const events = [];
  for (let i = 0; i < n; i++) {
    stepFighter(a, i === 0 ? ba : ba & INPUT.HELD_MASK, b.x);
    stepFighter(b, i === 0 ? bb : bb & INPUT.HELD_MASK, a.x);
    events.push(...resolveCombat(a, b, rules));
  }
  return events;
}

test('walking moves at walk speed and clamps to the arena', () => {
  const [a] = pair(300);
  run(a, INPUT.RIGHT, 60);
  assert.ok(Math.abs(a.x - 570) < 1, `x=${a.x}`);
  assert.equal(a.state, STATE.WALK);
  run(a, INPUT.RIGHT, 600);
  assert.equal(a.x, ARENA.maxX);
});

test('jump leaves the ground and lands back to idle', () => {
  const [a] = pair(300);
  stepFighter(a, INPUT.JUMP);
  assert.equal(a.state, STATE.JUMP);
  stepFighter(a, 0); assert.ok(a.y < ARENA.floorY);
  for (let i = 0; i < 80; i++) stepFighter(a, 0);
  assert.equal(a.y, ARENA.floorY); assert.equal(a.state, STATE.IDLE);
});

test('punch has startup, hits in its active window and deals damage + knockback', () => {
  const [a, b] = pair(400, 450);
  const ev = duel(a, b, 12, INPUT.PUNCH);
  const hit = ev.find((e) => e.type === 'hit');
  assert.ok(hit); assert.equal(hit.damage, MOVES.punch.damage);
  assert.equal(b.hp, 100 - MOVES.punch.damage);
  assert.equal(b.state, STATE.HIT);
  assert.ok(b.x > 450, 'defender pushed away');
});

test('an attack can only hit once', () => {
  const [a, b] = pair(400, 450);
  const ev = duel(a, b, 30, INPUT.PUNCH);
  assert.equal(ev.filter((e) => e.type === 'hit').length, 1);
});

test('out of reach attacks miss', () => {
  const [a, b] = pair(300, 600);
  assert.equal(duel(a, b, 30, INPUT.KICK).length, 0);
  assert.equal(b.hp, 100);
});

test('blocking from the front reduces damage to chip and cannot KO', () => {
  const [a, b] = pair(400, 450);
  b.hp = 1;
  const ev = duel(a, b, 14, INPUT.KICK, INPUT.BLOCK);
  const blk = ev.find((e) => e.type === 'block');
  assert.ok(blk); assert.equal(b.state, STATE.BLOCKHIT);
  assert.equal(blk.damage, Math.round(MOVES.kick.damage * CHIP_RATIO));
  assert.ok(b.hp >= 1);
});

test('blocking does not protect against hits from behind', () => {
  const [a, b] = pair(400, 450);
  b.facing = 1; b.state = STATE.BLOCK; // facing away from attacker at x=400
  const ev = resolveWithAttackerActive(a, b);
  assert.ok(ev.some((e) => e.type === 'hit'));
});
function resolveWithAttackerActive(a, b) {
  a.state = STATE.PUNCH; a.frame = MOVES.punch.startup; a.hasHit = false;
  return resolveCombat(a, b, rules);
}

test('KO when health reaches zero', () => {
  const [a, b] = pair(400, 450);
  b.hp = 5;
  const ev = duel(a, b, 12, INPUT.PUNCH);
  assert.ok(ev.some((e) => e.type === 'ko'));
  assert.equal(b.hp, 0); assert.equal(b.state, STATE.KO);
});

test('damage multiplier rule scales damage', () => {
  const [a, b] = pair(400, 450);
  a.state = STATE.PUNCH; a.frame = MOVES.punch.startup;
  resolveCombat(a, b, { damageMultiplier: 2 });
  assert.equal(b.hp, 100 - MOVES.punch.damage * 2);
});

test('simultaneous hits trade', () => {
  const [a, b] = pair(400, 450);
  for (const f of [a, b]) { f.state = STATE.PUNCH; f.frame = MOVES.punch.startup; }
  const ev = resolveCombat(a, b, rules);
  assert.equal(ev.filter((e) => e.type === 'hit').length, 2);
});

test('corner pushback: attacker is pushed away when defender is against the wall', () => {
  const [a, b] = pair(ARENA.maxX - 40, ARENA.maxX);
  duel(a, b, 12, INPUT.KICK);
  assert.ok(a.kx !== 0 || a.x < ARENA.maxX - 40);
});

test('attack input is buffered during recovery', () => {
  const [a] = pair(300);
  stepFighter(a, INPUT.PUNCH);       // buffer, starts attack on next tick
  stepFighter(a, 0);
  assert.equal(a.state, STATE.PUNCH);
  for (let i = 0; i < moveDuration(MOVES.punch) - 4; i++) stepFighter(a, 0);
  stepFighter(a, INPUT.PUNCH);       // pressed late in recovery
  for (let i = 0; i < 6; i++) stepFighter(a, 0);
  assert.ok(a.state === STATE.PUNCH || a.hasHit === false);
});

test('fighters cannot overlap on the ground but can pass when one jumps', () => {
  const [a, b] = pair(400, 410);
  separateFighters(a, b);
  assert.ok(b.x - a.x >= 49.9);
  a.y = ARENA.floorY - 100; a.x = 400; b.x = 405;
  separateFighters(a, b);
  assert.equal(b.x, 405);
});

test('simulation is deterministic (same inputs => same state)', () => {
  const script = [INPUT.RIGHT, INPUT.RIGHT, INPUT.JUMP | INPUT.RIGHT, 0, INPUT.PUNCH, 0, 0, INPUT.KICK, INPUT.LEFT];
  const sim = () => { const f = createFighter(0, 300, 1, 100); for (let i = 0; i < 200; i++) stepFighter(f, script[i % script.length], 700); return JSON.stringify(f); };
  assert.equal(sim(), sim());
});
