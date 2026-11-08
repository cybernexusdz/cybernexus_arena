import crypto from 'node:crypto';
import { ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH, normalizeCode, sanitizeName } from '../../../shared/protocol.js';
import { Room, RoomError } from './Room.js';

const DEFAULTS = { graceMs: 30000, resultsDelayMs: 8000, emptyRoomTtlMs: 60000, maxRooms: 500 };

export class RoomManager {
  constructor({ transport, config = {}, onResult } = {}) {
    this.transport = transport; this.cfg = { ...DEFAULTS, ...config }; this.onResult = onResult;
    this.rooms = new Map();      // code -> Room
    this.userRoom = new Map();   // userId -> code
  }

  #generateCode() {
    for (let i = 0; i < 50; i++) {
      let c = '';
      for (let j = 0; j < ROOM_CODE_LENGTH; j++) c += ROOM_CODE_ALPHABET[crypto.randomInt(ROOM_CODE_ALPHABET.length)];
      if (!this.rooms.has(c)) return c;
    }
    throw new RoomError('NO_CODE', 'Could not allocate a room code.');
  }
  getRoom(code) { return this.rooms.get(normalizeCode(code)) || null; }
  getRoomOf(userId) { const c = this.userRoom.get(userId); return c ? this.rooms.get(c) || null : null; }

  createRoom(user, { name, isPrivate = false, rules } = {}) {
    if (this.rooms.size >= this.cfg.maxRooms) throw new RoomError('SERVER_BUSY', 'Server is at capacity. Try again later.');
    this.leaveRoom(user.id);
    const code = this.#generateCode();
    const room = new Room({
      code, name: sanitizeName(name, `${user.name}'s room`, 3, 24), isPrivate: !!isPrivate, rules,
      transport: this.transport, config: this.cfg,
      hooks: {
        onRemoved: (id) => { if (this.userRoom.get(id) === code) { this.userRoom.delete(id); this.transport.leave(id, code); } },
        onEmpty: (c) => this.destroyRoom(c),
        onResult: (r) => this.onResult?.(r),
      },
    });
    this.rooms.set(code, room);
    this.userRoom.set(user.id, code);
    this.transport.join(user.id, code);
    room.addPlayer(user);
    return room;
  }

  joinRoom(user, rawCode) {
    const room = this.getRoom(rawCode);
    if (!room) throw new RoomError('ROOM_NOT_FOUND', 'No room with that code.');
    if (this.userRoom.get(user.id) === room.code && room.players.has(user.id)) {
      room.markReconnected(user.id, user.socketId); this.transport.join(user.id, room.code); return room;
    }
    if (room.isFull()) throw new RoomError('ROOM_FULL', 'This room is full (8/8).');
    this.leaveRoom(user.id);
    this.userRoom.set(user.id, room.code);
    this.transport.join(user.id, room.code);
    try { room.addPlayer(user); } catch (e) { this.userRoom.delete(user.id); this.transport.leave(user.id, room.code); throw e; }
    return room;
  }

  leaveRoom(userId) {
    const room = this.getRoomOf(userId);
    if (!room) return false;
    room.removePlayer(userId, 'left');
    if (room.players.size === 0) this.destroyRoom(room.code);
    return true;
  }

  /** Socket (re)connected: re-attach player to their room if they still have a seat. */
  handleConnect(user) {
    const room = this.getRoomOf(user.id);
    if (!room || !room.players.has(user.id)) { this.userRoom.delete(user.id); return null; }
    this.transport.join(user.id, room.code);
    room.markReconnected(user.id, user.socketId);
    return room;
  }
  handleDisconnect(userId, socketId) { this.getRoomOf(userId)?.markDisconnected(userId, socketId); }

  listPublic() {
    return [...this.rooms.values()].filter((r) => !r.isPrivate)
      .sort((a, b) => b.players.size - a.players.size || b.createdAt - a.createdAt)
      .slice(0, 100).map((r) => r.toSummary());
  }

  destroyRoom(code) {
    const room = this.rooms.get(code);
    if (!room) return;
    this.rooms.delete(code);
    room.destroy();
    for (const id of room.players.keys()) { if (this.userRoom.get(id) === code) this.userRoom.delete(id); }
    this.transport.emitToRoom(code, 'room:closed', { code });
    this.transport.closeRoom?.(code);
  }

  /** Safety net for any leaked/empty room. */
  sweep() { for (const r of [...this.rooms.values()]) if (r.players.size === 0) this.destroyRoom(r.code); }
  tick() { for (const r of this.rooms.values()) r.tick(); }
  stats() { return { rooms: this.rooms.size, players: this.userRoom.size }; }
}
