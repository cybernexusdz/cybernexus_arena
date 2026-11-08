import crypto from 'node:crypto';
import { promisify } from 'node:util';
import { sanitizeName } from '../../../shared/protocol.js';

const scrypt = promisify(crypto.scrypt);
export class AuthError extends Error { constructor(status, message) { super(message); this.status = status; } }

export class AuthService {
  constructor({ store, secret, tokenTtlMs = 7 * 24 * 3600 * 1000, now = () => Date.now() }) {
    this.store = store; this.secret = secret; this.ttl = tokenTtlMs; this.now = now;
  }
  signToken(user) {
    const payload = Buffer.from(JSON.stringify({ id: user.id, name: user.name, guest: !!user.guest, exp: this.now() + this.ttl })).toString('base64url');
    const sig = crypto.createHmac('sha256', this.secret).update(payload).digest('base64url');
    return `${payload}.${sig}`;
  }
  verifyToken(token) {
    if (typeof token !== 'string') return null;
    const [payload, sig] = token.split('.');
    if (!payload || !sig) return null;
    const expected = crypto.createHmac('sha256', this.secret).update(payload).digest();
    let given; try { given = Buffer.from(sig, 'base64url'); } catch { return null; }
    if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) return null;
    try {
      const d = JSON.parse(Buffer.from(payload, 'base64url').toString());
      if (!d.id || d.exp < this.now()) return null;
      return { id: d.id, name: d.name, guest: !!d.guest };
    } catch { return null; }
  }
  #session(user) { return { user: this.publicUser(user), token: this.signToken(user) }; }
  publicUser(u) { const rec = this.store.findById(u.id); return { id: u.id, name: u.name, guest: !!u.guest, wins: rec?.wins ?? 0, losses: rec?.losses ?? 0 }; }

  guest(rawName) {
    const name = sanitizeName(rawName, `Guest${crypto.randomInt(1000, 9999)}`);
    return this.#session({ id: 'g_' + crypto.randomBytes(8).toString('hex'), name, guest: true });
  }
  async register(username, password) {
    if (typeof username !== 'string' || !/^[A-Za-z0-9_]{3,16}$/.test(username)) throw new AuthError(400, 'Username must be 3-16 letters, numbers or underscores.');
    if (typeof password !== 'string' || password.length < 6 || password.length > 72) throw new AuthError(400, 'Password must be 6-72 characters.');
    if (this.store.findByName(username)) throw new AuthError(409, 'That username is taken.');
    const salt = crypto.randomBytes(16);
    const hash = await scrypt(password, salt, 64);
    const rec = this.store.create({ id: 'u_' + crypto.randomBytes(8).toString('hex'), username, passHash: `${salt.toString('hex')}:${hash.toString('hex')}`, wins: 0, losses: 0, createdAt: this.now() });
    return this.#session({ id: rec.id, name: rec.username });
  }
  async login(username, password) {
    const rec = typeof username === 'string' ? this.store.findByName(username) : null;
    const bad = new AuthError(401, 'Wrong username or password.');
    if (!rec || typeof password !== 'string') throw bad;
    const [saltHex, hashHex] = rec.passHash.split(':');
    const hash = await scrypt(password, Buffer.from(saltHex, 'hex'), 64);
    const want = Buffer.from(hashHex, 'hex');
    if (hash.length !== want.length || !crypto.timingSafeEqual(hash, want)) throw bad;
    return this.#session({ id: rec.id, name: rec.username });
  }
  me(token) {
    const u = this.verifyToken(token);
    if (!u) throw new AuthError(401, 'Session expired.');
    return this.publicUser(u);
  }
  recordResult(winnerId, loserId) {
    for (const [id, key] of [[winnerId, 'wins'], [loserId, 'losses']]) {
      const rec = id && this.store.findById(id);
      if (rec) { rec[key]++; this.store.save(); }
    }
  }
}
