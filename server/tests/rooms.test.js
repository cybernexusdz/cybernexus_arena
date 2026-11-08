import test from 'node:test';
import assert from 'node:assert/strict';
import { makeManager, roomWith, user, readyAndStart, sleep } from './helpers.js';
import { ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH, MAX_PLAYERS, DEFAULT_RULES } from '../../shared/protocol.js';

const finish = (room, winnerSlot) => room.match.forfeit(1 - winnerSlot, 'forfeit');

test('creates a room with a valid unique code; creator is host and P1', () => {
  const { manager } = makeManager();
  const codes = new Set();
  for (let i = 1; i <= 40; i++) {
    const r = manager.createRoom(user(i), {});
    assert.equal(r.code.length, ROOM_CODE_LENGTH);
    assert.ok([...r.code].every((c) => ROOM_CODE_ALPHABET.includes(c)));
    codes.add(r.code);
  }
  assert.equal(codes.size, 40);
  const r = manager.createRoom(user(100), { name: 'My Room' });
  assert.equal(r.hostId, 'u100'); assert.deepEqual(r.fighters, ['u100', null]);
});

test('second player takes P2, the rest queue as spectators with positions', () => {
  const { room } = roomWith(5);
  assert.deepEqual(room.fighters, ['u1', 'u2']);
  assert.deepEqual(room.queue, ['u3', 'u4', 'u5']);
  const pub = room.toPublic();
  assert.deepEqual(pub.players.filter((p) => p.role === 'spectator').map((p) => p.queuePosition), [1, 2, 3]);
  assert.equal(pub.players.filter((p) => p.role === 'fighter').length, 2);
});

test('enforces the 8 player cap', () => {
  const { manager, room } = roomWith(MAX_PLAYERS);
  assert.equal(room.players.size, 8);
  assert.throws(() => manager.joinRoom(user(9), room.code), { code: 'ROOM_FULL' });
  assert.equal(manager.getRoomOf('u9'), null);
});

test('private rooms are hidden from discovery but joinable by (case-insensitive) code', () => {
  const { manager } = makeManager();
  const pub = manager.createRoom(user(1), { name: 'Open' });
  const priv = manager.createRoom(user(2), { name: 'Secret', isPrivate: true });
  const list = manager.listPublic();
  assert.deepEqual(list.map((r) => r.code), [pub.code]);
  manager.joinRoom(user(3), ` ${priv.code.toLowerCase()} `);
  assert.ok(priv.players.has('u3'));
  assert.throws(() => manager.joinRoom(user(4), 'ZZZZZ'), { code: 'ROOM_NOT_FOUND' });
});

test('a user can only be in one room: joining another leaves the first, empty rooms vanish', () => {
  const { manager } = makeManager();
  const a = manager.createRoom(user(1), {});
  const b = manager.createRoom(user(2), {});
  manager.joinRoom(user(1), b.code);
  assert.equal(manager.getRoom(a.code), null);
  assert.equal(manager.getRoomOf('u1').code, b.code);
});

test('host migrates to a connected player on leave and on disconnect', () => {
  const { manager, room } = roomWith(4);
  manager.leaveRoom('u1');
  assert.equal(room.hostId, 'u2');
  manager.handleDisconnect('u2', 's2');
  assert.equal(room.hostId, 'u3');                 // skips disconnected, prefers fighters then queue
  manager.handleConnect({ ...user(2) });
  assert.equal(room.hostId, 'u3');                 // returning player does not steal host
});

test('leaving fighter is replaced by the first spectator in the queue (lobby)', () => {
  const { manager, room } = roomWith(4);
  manager.leaveRoom('u2');
  assert.deepEqual(room.fighters, ['u1', 'u3']); assert.deepEqual(room.queue, ['u4']);
});

test('ready & start rules', () => {
  const { room } = roomWith(3);
  assert.throws(() => room.setReady('u3', true), { code: 'NOT_FIGHTER' });
  assert.throws(() => room.startMatch('u2'), { code: 'NOT_HOST' });
  assert.throws(() => room.startMatch('u1'), { code: 'NOT_READY' });
  room.setReady('u1', true); assert.throws(() => room.startMatch('u1'), { code: 'NOT_READY' });
  room.setReady('u2', true);
  room.startMatch('u1');
  assert.equal(room.phase, 'match'); assert.ok(room.match);
  assert.throws(() => room.setReady('u1', false), { code: 'BAD_PHASE' });
});

test('cannot start with a single fighter', () => {
  const { manager } = makeManager();
  const r = manager.createRoom(user(1), {}); r.setReady('u1', true);
  assert.throws(() => r.startMatch('u1'), { code: 'NOT_ENOUGH_FIGHTERS' });
});

test('only fighters\' inputs reach the match; spectators are ignored', () => {
  const { room } = roomWith(3); readyAndStart(room);
  assert.equal(room.handleInput('u3', [{ seq: 1, bits: 1 }]), 0);
  assert.equal(room.handleInput('u1', [{ seq: 1, bits: 1 }]), 1);
});

test('disconnect + reconnect within grace keeps the seat', () => {
  const { manager, room } = roomWith(3);
  manager.handleDisconnect('u2', 's2');
  assert.equal(room.players.get('u2').connected, false);
  room.setReady('u1', true);
  assert.throws(() => room.startMatch('u1'), { code: 'FIGHTER_OFFLINE' });
  const back = manager.handleConnect({ ...user(2), socketId: 'new' });
  assert.equal(back, room); assert.equal(room.players.get('u2').connected, true);
  assert.deepEqual(room.fighters, ['u1', 'u2']);
});

test('stale socket disconnects are ignored after a reconnect', () => {
  const { manager, room } = roomWith(2);
  manager.handleConnect({ ...user(2), socketId: 'fresh' });
  manager.handleDisconnect('u2', 's2');               // old socket closing late
  assert.equal(room.players.get('u2').connected, true);
});

test('grace expiry removes the player; a disconnected fighter forfeits an active match', () => {
  const { manager, room } = roomWith(3); readyAndStart(room);
  manager.handleDisconnect('u2', 's2');
  room.expire('u2');
  assert.equal(room.players.has('u2'), false);
  assert.equal(room.phase, 'results');
  assert.equal(room.lastResult.winnerId, 'u1'); assert.equal(room.lastResult.reason, 'timeout');
});

test('grace timer fires on its own', async () => {
  const { manager, room } = roomWith(2, {}, { graceMs: 15 });
  manager.handleDisconnect('u2', 's2');
  await sleep(40);
  assert.equal(room.players.has('u2'), false);
});

test('winner-stays: winner keeps slot, loser queues at the back, next spectator steps up', () => {
  const { room, results } = roomWith(4); readyAndStart(room);
  finish(room, 0);                                  // u1 wins
  assert.equal(room.phase, 'results'); assert.equal(room.lastResult.winnerId, 'u1');
  assert.deepEqual(room.lastResult.upNext, ['Player1', 'Player3']);
  assert.equal(results.length, 1);
  room.advance();
  assert.equal(room.phase, 'lobby');
  assert.deepEqual(room.fighters, ['u1', 'u3']); assert.deepEqual(room.queue, ['u4', 'u2']);
  assert.ok([...room.players.values()].every((p) => !p.ready));
});

test('winner-stays keeps the winner in the correct slot when slot 2 wins', () => {
  const { room } = roomWith(3); readyAndStart(room);
  finish(room, 1); room.advance();
  assert.deepEqual(room.fighters, ['u3', 'u2']); assert.deepEqual(room.queue, ['u1']);
});

test('queue rotation: both fighters go to the back, next two spectators fight', () => {
  const { room } = roomWith(5, { rules: { ...DEFAULT_RULES, rotation: 'queue' } }); readyAndStart(room);
  finish(room, 0); room.advance();
  assert.deepEqual(room.fighters, ['u3', 'u4']); assert.deepEqual(room.queue, ['u5', 'u2', 'u1']);
});

test('with no spectators the same two fighters rematch in both modes', () => {
  for (const rotation of ['winner-stays', 'queue']) {
    const { room } = roomWith(2, { rules: { rotation } }); readyAndStart(room);
    finish(room, 1); room.advance();
    assert.deepEqual([...room.fighters].sort(), ['u1', 'u2'], rotation);
  }
});

test('results auto-advance after the configured delay', async () => {
  const { room } = roomWith(3, {}, { resultsDelayMs: 15 }); readyAndStart(room);
  finish(room, 0); await sleep(40);
  assert.equal(room.phase, 'lobby');
});

test('spectators who join mid-match queue behind existing spectators', () => {
  const { manager, room } = roomWith(3); readyAndStart(room);
  manager.joinRoom(user(4), room.code);
  assert.deepEqual(room.queue, ['u3', 'u4']);
  assert.equal(room.fighters.includes('u4'), false);
});

test('only the host can change rules, only in the lobby, and values are clamped', () => {
  const { room } = roomWith(2);
  assert.throws(() => room.updateRules('u2', { roundsToWin: 3 }), { code: 'NOT_HOST' });
  room.updateRules('u1', { roundsToWin: 99, roundTime: -5, maxHealth: 'x', damageMultiplier: 1.26, rotation: 'queue', stage: 'nope' });
  assert.equal(room.rules.roundsToWin, 5); assert.equal(room.rules.roundTime, 15);
  assert.equal(room.rules.maxHealth, DEFAULT_RULES.maxHealth); assert.equal(room.rules.damageMultiplier, 1.3);
  assert.equal(room.rules.rotation, 'queue'); assert.equal(room.rules.stage, 'dojo');
  readyAndStart(room);
  assert.throws(() => room.updateRules('u1', { roundsToWin: 1 }), { code: 'BAD_PHASE' });
});

test('host can kick; non-host cannot; host cannot kick self', () => {
  const { manager, room, transport } = roomWith(3);
  assert.throws(() => room.kick('u2', 'u3'), { code: 'NOT_HOST' });
  assert.throws(() => room.kick('u1', 'u1'), { code: 'BAD_TARGET' });
  room.kick('u1', 'u3');
  assert.equal(room.players.has('u3'), false); assert.equal(manager.getRoomOf('u3'), null);
  assert.equal(transport.of('room:kicked').length, 1);
});

test('rooms are cleaned up: when empty, and after everyone stays disconnected past the TTL', async () => {
  const { manager, room } = roomWith(2);
  manager.leaveRoom('u1'); manager.leaveRoom('u2');
  assert.equal(manager.rooms.size, 0);

  const ctx = roomWith(2, {}, { emptyRoomTtlMs: 15, graceMs: 10_000 });
  ctx.manager.handleDisconnect('u1', 's1'); ctx.manager.handleDisconnect('u2', 's2');
  assert.equal(ctx.manager.rooms.size, 1);
  await sleep(40);
  assert.equal(ctx.manager.rooms.size, 0); assert.equal(ctx.manager.getRoomOf('u1'), null);
});

test('reconnecting before the TTL cancels cleanup', async () => {
  const ctx = roomWith(2, {}, { emptyRoomTtlMs: 30, graceMs: 10_000 });
  ctx.manager.handleDisconnect('u1', 's1'); ctx.manager.handleDisconnect('u2', 's2');
  ctx.manager.handleConnect({ ...user(1), socketId: 'x' });
  await sleep(60);
  assert.equal(ctx.manager.rooms.size, 1);
});

test('room capacity limit protects the server', () => {
  const { manager } = makeManager({ maxRooms: 2 });
  manager.createRoom(user(1), {}); manager.createRoom(user(2), {});
  assert.throws(() => manager.createRoom(user(3), {}), { code: 'SERVER_BUSY' });
});

test('broadcasts room state on every change and full state includes roles', () => {
  const { room, transport } = roomWith(3);
  const before = transport.of('room:state').length;
  room.setReady('u1', true);
  assert.equal(transport.of('room:state').length, before + 1);
  const p = room.toPublic().players.find((x) => x.id === 'u1');
  assert.ok(p.ready && p.isHost && p.role === 'fighter' && p.slot === 0);
});

test('full match flow through the room: ticks drive the match to a result', () => {
  const { room } = roomWith(3, { rules: { roundsToWin: 1, roundTime: 15 } }); readyAndStart(room);
  let guard = 0;
  while (room.phase === 'match' && guard++ < 60 * 80) {
    room.tick();
    if (room.match.phase === 'fighting') room.match.fighters[1].hp = 0; // force a KO for slot 2
  }
  assert.equal(room.phase, 'results'); assert.equal(room.lastResult.winnerId, 'u1');
});
