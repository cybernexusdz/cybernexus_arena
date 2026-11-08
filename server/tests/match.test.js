import test from 'node:test';
import assert from 'node:assert/strict';
import { Match } from '../src/game/Match.js';
import { INPUT, STATE, TICK_RATE } from '../../shared/sim.js';
import { DEFAULT_RULES } from '../../shared/protocol.js';

const players = [{ id: 'a', name: 'A', character: 'azure' }, { id: 'b', name: 'B', character: 'solar' }];
function mk(rules = {}) {
  const events = []; let ended = null; const snaps = [];
  const m = new Match({ players, rules: { ...DEFAULT_RULES, ...rules }, onEvent: (e) => events.push(e), onEnd: (r) => { ended = r; }, onSnapshot: (s) => snaps.push(s) });
  return { m, events, snaps, ended: () => ended };
}
const tick = (m, n) => { for (let i = 0; i < n; i++) m.tick(); };
const startFight = (m) => { tick(m, 3 * TICK_RATE); assert.equal(m.phase, 'fighting'); };
const nearby = (m) => { m.fighters[0].x = 400; m.fighters[1].x = 450; };

test('countdown then fighting; inputs ignored during countdown', () => {
  const { m, events } = mk();
  assert.equal(m.phase, 'countdown');
  m.pushInputs(0, [{ seq: 1, bits: INPUT.RIGHT }]);
  tick(m, 60); assert.equal(m.fighters[0].x, 300);
  tick(m, 120);
  assert.equal(m.phase, 'fighting');
  assert.deepEqual(events.filter((e) => e.type === 'countdown').map((e) => e.n), [3, 2, 1]);
  assert.ok(events.some((e) => e.type === 'fight'));
});

test('server applies input frames one per tick and acknowledges them', () => {
  const { m } = mk(); startFight(m);
  m.pushInputs(0, [1, 2, 3].map((seq) => ({ seq, bits: INPUT.RIGHT })));
  tick(m, 1); assert.equal(m.snapshot().fighters[0].ack, 1);
  tick(m, 2); assert.equal(m.snapshot().fighters[0].ack, 3);
});

test('input validation rejects replays, bad bits, absurd jumps and floods', () => {
  const { m } = mk(); startFight(m);
  assert.equal(m.pushInputs(0, [{ seq: 1, bits: 1 }, { seq: 1, bits: 1 }]), 1);       // duplicate
  assert.equal(m.pushInputs(0, [{ seq: 2, bits: 999 }, { seq: 3, bits: -1 }, { seq: 'x', bits: 1 }, null]), 0);
  assert.equal(m.pushInputs(0, [{ seq: 5000, bits: 1 }]), 0);                          // seq jump
  assert.equal(m.pushInputs(0, 'garbage'), 0);
  const flood = Array.from({ length: 20 }, (_, i) => ({ seq: 10 + i, bits: 1 }));
  assert.ok(m.pushInputs(0, flood) <= 15 && m.queues[0].length <= 15);               // cannot outrun 60 Hz
  assert.equal(m.pushInputs(2, [{ seq: 1, bits: 1 }]), 0);                             // invalid slot
});

test('client cannot move faster than the sim: 100 queued frames still move 1 step/tick', () => {
  const { m } = mk(); startFight(m);
  for (let k = 0; k < 10; k++) m.pushInputs(0, Array.from({ length: 20 }, (_, i) => ({ seq: k * 20 + i + 1, bits: INPUT.RIGHT })));
  const x0 = m.fighters[0].x; tick(m, 10);
  assert.ok(m.fighters[0].x - x0 <= 10 * 270 / 60 + 1);
});

test('KO ends the round, awards a win, then next round starts; first to roundsToWin takes the match', () => {
  const { m, events, ended } = mk({ roundsToWin: 2 }); startFight(m);
  nearby(m); m.fighters[1].hp = 1;
  m.pushInputs(0, [{ seq: 1, bits: INPUT.PUNCH }]);
  tick(m, 15);
  assert.equal(m.phase, 'roundOver'); assert.deepEqual(m.wins, [1, 0]);
  assert.equal(events.find((e) => e.type === 'roundEnd').reason, 'ko');
  tick(m, 2 * TICK_RATE); assert.equal(m.round, 2); assert.equal(m.phase, 'countdown'); assert.equal(m.fighters[1].hp, 100);
  startFight(m); nearby(m); m.fighters[1].hp = 1;
  m.pushInputs(0, [{ seq: 2, bits: INPUT.PUNCH }]);
  tick(m, 15 + 2 * TICK_RATE);
  assert.ok(m.finished); assert.equal(ended().winnerId, 'a'); assert.equal(ended().loserId, 'b'); assert.deepEqual(ended().wins, [2, 0]);
});

test('timer expiry: higher health wins the round; equal health is a draw for both', () => {
  const { m } = mk({ roundTime: 15 }); startFight(m);
  m.fighters[0].hp = 40; m.timeLeft = 1; tick(m, 1);
  assert.deepEqual(m.wins, [0, 1]);
  tick(m, 2 * TICK_RATE + 1); startFight(m);
  m.timeLeft = 1; tick(m, 1);
  assert.deepEqual(m.wins, [1, 2]);
});

test('tied scores at the target continue into a tiebreak round', () => {
  const { m } = mk({ roundsToWin: 1 }); startFight(m);
  m.timeLeft = 1; tick(m, 1);                 // equal hp => 1-1
  assert.deepEqual(m.wins, [1, 1]);
  tick(m, 2 * TICK_RATE); assert.equal(m.finished, false); assert.equal(m.round, 2);
});

test('forfeit ends the match immediately in favour of the opponent', () => {
  const { m, ended } = mk(); startFight(m);
  m.forfeit(1, 'timeout');
  assert.equal(ended().winnerId, 'a'); assert.equal(ended().reason, 'timeout'); assert.ok(m.finished);
  m.forfeit(0); assert.equal(ended().winnerId, 'a'); // idempotent
});

test('snapshots are emitted at 30 Hz with full fighter state', () => {
  const { m, snaps } = mk(); tick(m, 60);
  assert.equal(snaps.length, 30);
  const f = snaps.at(-1).fighters[0];
  for (const k of ['x', 'y', 'vx', 'vy', 'facing', 'state', 'frame', 'hp', 'ack', 'buffer']) assert.ok(k in f, k);
});

test('stale input repeats held keys briefly then stops (dropped client cannot run forever)', () => {
  const { m } = mk(); startFight(m);
  m.pushInputs(0, [{ seq: 1, bits: INPUT.RIGHT }]);
  tick(m, 40);
  assert.ok(m.fighters[0].x < 300 + 8 * 270 / 60 + 1);
  assert.equal(m.fighters[0].state === STATE.IDLE || m.fighters[0].state === STATE.WALK, true);
});
