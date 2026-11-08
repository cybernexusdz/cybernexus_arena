import {
  MAX_PLAYERS, ROTATION, ROOM_PHASE, CHARACTERS, sanitizeRules, DEFAULT_RULES,
} from '../../../shared/protocol.js';
import { Match } from '../game/Match.js';

export class RoomError extends Error { constructor(code, message) { super(message); this.code = code; } }
const timer = (fn, ms) => { const t = setTimeout(fn, ms); t.unref?.(); return t; };

export class Room {
  /**
   * transport: { emitToRoom(code, ev, data, opts), emitToUser(id, ev, data), join(id, code), leave(id, code) }
   * hooks: { onRemoved(userId), onEmpty(code), onResult(result) }
   */
  constructor({ code, name, isPrivate, rules, transport, config, hooks = {} }) {
    this.code = code; this.name = name; this.isPrivate = !!isPrivate;
    this.rules = sanitizeRules(rules, DEFAULT_RULES);
    this.transport = transport; this.cfg = config; this.hooks = hooks;
    this.players = new Map();          // userId -> player
    this.fighters = [null, null];      // userIds in slots P1/P2
    this.queue = [];                   // spectator queue (userIds, front = next up)
    this.hostId = null; this.phase = ROOM_PHASE.LOBBY;
    this.match = null; this.matchId = 0; this.lastResult = null;
    this.createdAt = Date.now(); this.resultsTimer = null; this.emptyTimer = null;
  }

  // ---------- membership ----------
  get connectedCount() { let n = 0; for (const p of this.players.values()) if (p.connected) n++; return n; }
  isFull() { return this.players.size >= MAX_PLAYERS; }

  addPlayer(user) {
    if (this.players.has(user.id)) return this.players.get(user.id);
    if (this.isFull()) throw new RoomError('ROOM_FULL', 'This room is full (8/8).');
    const taken = new Set(this.fighters.map((id) => this.players.get(id)?.character));
    const character = (CHARACTERS.find((c) => !taken.has(c.id)) || CHARACTERS[this.players.size % CHARACTERS.length]).id;
    const p = { id: user.id, name: user.name, character, socketId: user.socketId ?? null, connected: true, ready: false, joinedAt: Date.now(), graceTimer: null };
    this.players.set(p.id, p);
    this.#seat(p.id);
    if (!this.hostId) this.hostId = p.id;
    this.#checkEmpty();
    this.#notice(`${p.name} joined`);
    this.broadcast();
    return p;
  }

  #seat(id) {
    if (this.phase === ROOM_PHASE.LOBBY) {
      const i = this.fighters.indexOf(null);
      if (i >= 0) { this.fighters[i] = id; return; }
    }
    this.queue.push(id);
  }

  fillSlots() {
    for (let i = 0; i < 2; i++) {
      if (this.fighters[i]) continue;
      const k = this.queue.findIndex((id) => this.players.get(id)?.connected);
      if (k >= 0) { const [id] = this.queue.splice(k, 1); this.fighters[i] = id; this.players.get(id).ready = false; }
    }
  }

  removePlayer(id, reason = 'left') {
    const p = this.players.get(id);
    if (!p) return false;
    clearTimeout(p.graceTimer);
    const slot = this.fighters.indexOf(id);
    this.players.delete(id);
    this.queue = this.queue.filter((x) => x !== id);
    if (slot >= 0) this.fighters[slot] = null;
    if (this.hostId === id) this.#migrateHost();
    if (this.match && !this.match.finished && slot >= 0) this.match.forfeit(slot, reason === 'left' ? 'forfeit' : reason);
    if (this.phase === ROOM_PHASE.LOBBY) this.fillSlots();
    this.hooks.onRemoved?.(id);
    this.#notice(reason === 'kicked' ? `${p.name} was kicked` : `${p.name} left`);
    this.broadcast();
    this.#checkEmpty();
    return true;
  }

  #migrateHost() {
    const order = [...this.fighters, ...this.queue].filter((id) => id && this.players.has(id));
    const next = order.find((id) => this.players.get(id).connected) ?? order[0] ?? null;
    this.hostId = next;
    if (next) this.#notice(`${this.players.get(next).name} is now the host`);
  }

  markDisconnected(id, socketId) {
    const p = this.players.get(id);
    if (!p || (socketId && p.socketId !== socketId)) return false; // stale socket
    p.connected = false; p.socketId = null; p.ready = false;
    clearTimeout(p.graceTimer);
    p.graceTimer = timer(() => this.expire(id), this.cfg.graceMs);
    if (this.hostId === id) this.#migrateHost();
    this.#notice(`${p.name} disconnected`);
    this.broadcast(); this.#checkEmpty();
    return true;
  }
  markReconnected(id, socketId) {
    const p = this.players.get(id);
    if (!p) return false;
    clearTimeout(p.graceTimer); p.graceTimer = null;
    const wasDown = !p.connected;
    p.connected = true; p.socketId = socketId;
    if (wasDown) this.#notice(`${p.name} reconnected`);
    this.broadcast(); this.#checkEmpty();
    return true;
  }
  expire(id) { const p = this.players.get(id); if (p && !p.connected) this.removePlayer(id, 'timeout'); }

  #checkEmpty() {
    if (this.players.size === 0) { this.hooks.onEmpty?.(this.code); return; }
    if (this.connectedCount > 0) { clearTimeout(this.emptyTimer); this.emptyTimer = null; }
    else if (!this.emptyTimer) this.emptyTimer = timer(() => this.hooks.onEmpty?.(this.code), this.cfg.emptyRoomTtlMs);
  }

  // ---------- lobby actions ----------
  #requireHost(id) { if (id !== this.hostId) throw new RoomError('NOT_HOST', 'Only the host can do that.'); }
  #requireLobby() { if (this.phase !== ROOM_PHASE.LOBBY) throw new RoomError('BAD_PHASE', 'Not available during a match.'); }

  setReady(id, ready) {
    this.#requireLobby();
    if (!this.fighters.includes(id)) throw new RoomError('NOT_FIGHTER', 'Only fighters can ready up.');
    this.players.get(id).ready = !!ready; this.broadcast();
  }
  setCharacter(id, character) {
    this.#requireLobby();
    if (!CHARACTERS.some((c) => c.id === character)) throw new RoomError('BAD_CHARACTER', 'Unknown character.');
    this.players.get(id).character = character; this.broadcast();
  }
  updateRules(id, rules) {
    this.#requireHost(id); this.#requireLobby();
    this.rules = sanitizeRules(rules, this.rules); this.broadcast();
  }
  kick(hostId, targetId) {
    this.#requireHost(hostId);
    if (targetId === hostId || !this.players.has(targetId)) throw new RoomError('BAD_TARGET', 'Cannot kick that player.');
    this.transport.emitToUser(targetId, 'room:kicked', { code: this.code });
    this.removePlayer(targetId, 'kicked');
  }

  startMatch(id) {
    this.#requireHost(id); this.#requireLobby();
    const [a, b] = this.fighters.map((x) => this.players.get(x));
    if (!a || !b) throw new RoomError('NOT_ENOUGH_FIGHTERS', 'Two fighters are required.');
    if (!a.connected || !b.connected) throw new RoomError('FIGHTER_OFFLINE', 'A fighter is disconnected.');
    if (!a.ready || !b.ready) throw new RoomError('NOT_READY', 'Both fighters must be ready.');
    this.matchId++;
    this.match = new Match({
      players: [a, b].map((p) => ({ id: p.id, name: p.name, character: p.character })),
      rules: { ...this.rules },
      onSnapshot: (s) => this.transport.emitToRoom(this.code, 'match:state', s, { volatile: true }),
      onEvent: (e) => this.transport.emitToRoom(this.code, 'match:event', e),
      onEnd: (r) => this.#handleMatchEnd(r),
    });
    this.phase = ROOM_PHASE.MATCH;
    this.broadcast();
  }

  handleInput(userId, frames) {
    if (this.phase !== ROOM_PHASE.MATCH || !this.match) return 0;
    const slot = this.fighters.indexOf(userId);   // spectators have no slot => ignored
    return slot < 0 ? 0 : this.match.pushInputs(slot, frames);
  }

  tick() { if (this.match && !this.match.finished) this.match.tick(); }

  // ---------- results & rotation ----------
  #handleMatchEnd(result) {
    this.phase = ROOM_PHASE.RESULTS;
    const upNext = this.planRotation(result);
    this.lastResult = { ...result, upNext: upNext.fighters.map((id) => this.players.get(id)?.name).filter(Boolean), at: Date.now() };
    this.hooks.onResult?.(result);
    this.transport.emitToRoom(this.code, 'match:result', this.lastResult);
    clearTimeout(this.resultsTimer);
    this.resultsTimer = timer(() => this.advance(), this.cfg.resultsDelayMs);
    this.broadcast();
  }

  /** Pure: compute next fighters + queue per rotation mode. */
  planRotation(res = this.lastResult) {
    const present = (id) => id && this.players.has(id);
    const inSlots = this.fighters.filter(present);
    const queue = [...this.queue];
    let fighters = [null, null];
    if (this.rules.rotation === ROTATION.QUEUE) {
      // Both fighters go to the back (loser first), next two spectators step up.
      queue.push(...[...inSlots].sort((a, b) => (a === res?.winnerId) - (b === res?.winnerId)));
    } else {
      // Winner stays in their slot; loser joins the back of the queue.
      const stay = res?.winnerId && inSlots.includes(res.winnerId) ? res.winnerId : null;
      fighters = this.fighters.map((id) => (id && id === stay ? id : null));
      queue.push(...inSlots.filter((id) => id !== stay));
    }
    for (let i = 0; i < 2; i++) {
      if (fighters[i]) continue;
      const k = queue.findIndex((id) => this.players.get(id)?.connected);
      if (k >= 0) fighters[i] = queue.splice(k, 1)[0];
    }
    return { fighters, queue };
  }

  advance() {
    if (this.phase !== ROOM_PHASE.RESULTS) return false;
    clearTimeout(this.resultsTimer);
    const { fighters, queue } = this.planRotation();
    this.fighters = fighters; this.queue = queue;
    for (const p of this.players.values()) p.ready = false;
    this.phase = ROOM_PHASE.LOBBY; this.match = null;
    this.transport.emitToRoom(this.code, 'room:rotated', { fighters: fighters.map((id) => this.players.get(id)?.name ?? null) });
    this.broadcast();
    return true;
  }

  // ---------- views ----------
  #notice(message) { this.transport.emitToRoom(this.code, 'room:notice', { message }); }
  toPublic() {
    const players = [];
    const push = (id) => {
      const p = this.players.get(id); if (!p) return;
      const slot = this.fighters.indexOf(id);
      players.push({
        id, name: p.name, character: p.character, connected: p.connected, ready: p.ready, isHost: id === this.hostId,
        role: slot >= 0 ? 'fighter' : 'spectator', slot, queuePosition: slot >= 0 ? 0 : this.queue.indexOf(id) + 1,
      });
    };
    this.fighters.forEach((id) => id && push(id));
    this.queue.forEach(push);
    return {
      code: this.code, name: this.name, isPrivate: this.isPrivate, hostId: this.hostId, phase: this.phase,
      rules: this.rules, maxPlayers: MAX_PLAYERS, players, fighters: [...this.fighters], queue: [...this.queue],
      matchId: this.matchId, lastResult: this.lastResult,
      match: this.match ? { players: this.match.players, rules: this.match.rules } : null,
    };
  }
  toSummary() {
    const host = this.players.get(this.hostId);
    return { code: this.code, name: this.name, players: this.players.size, maxPlayers: MAX_PLAYERS, phase: this.phase, host: host?.name ?? '—', rotation: this.rules.rotation, roundsToWin: this.rules.roundsToWin };
  }
  broadcast() { this.transport.emitToRoom(this.code, 'room:state', this.toPublic()); }

  destroy() {
    clearTimeout(this.resultsTimer); clearTimeout(this.emptyTimer);
    for (const p of this.players.values()) clearTimeout(p.graceTimer);
    this.match?.abort();
  }
}
