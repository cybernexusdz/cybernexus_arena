import test from 'node:test';
import assert from 'node:assert/strict';
import { AuthService } from '../src/auth/AuthService.js';
import { UserStore } from '../src/auth/UserStore.js';

const mk = (now) => new AuthService({ store: new UserStore(':memory:'), secret: 's3cret', now });

test('register, login, token round-trip', async () => {
  const a = mk();
  const { user, token } = await a.register('Ryu_01', 'hunter22');
  assert.equal(a.verifyToken(token).id, user.id);
  const again = await a.login('ryu_01', 'hunter22');
  assert.equal(again.user.id, user.id);
});
test('rejects bad credentials, duplicates and invalid input', async () => {
  const a = mk(); await a.register('Ken', 'password1');
  await assert.rejects(a.login('Ken', 'nope'), { status: 401 });
  await assert.rejects(a.login('ghost', 'password1'), { status: 401 });
  await assert.rejects(a.register('ken', 'password1'), { status: 409 });
  await assert.rejects(a.register('x', 'password1'), { status: 400 });
  await assert.rejects(a.register('validname', '123'), { status: 400 });
});
test('guests get signed tokens with sanitized names', () => {
  const a = mk(); const { user, token } = a.guest('  <b>Bob</b> ');
  assert.equal(user.name, 'bBobb');
  assert.ok(!/[<>]/.test(user.name)); assert.ok(a.verifyToken(token).guest);
});
test('tampered and expired tokens are rejected', () => {
  let t = 1000; const a = mk(() => t);
  const { token } = a.guest('Guesty');
  const [p, s] = token.split('.');
  const forged = Buffer.from(JSON.stringify({ id: 'admin', name: 'x', exp: 9e15 })).toString('base64url');
  assert.equal(a.verifyToken(`${forged}.${s}`), null);
  assert.equal(a.verifyToken(p + '.' + 'A'.repeat(s.length)), null);
  assert.equal(a.verifyToken('garbage'), null); assert.equal(a.verifyToken(undefined), null);
  t += 8 * 24 * 3600 * 1000; assert.equal(a.verifyToken(token), null);
});
test('win/loss stats are recorded for registered users only', async () => {
  const a = mk(); const w = await a.register('Winner', 'password1'); const l = await a.register('Loser', 'password1');
  a.recordResult(w.user.id, l.user.id); a.recordResult('g_guest', l.user.id);
  assert.equal(a.publicUser(w.user).wins, 1); assert.equal(a.publicUser(l.user).losses, 2);
});
