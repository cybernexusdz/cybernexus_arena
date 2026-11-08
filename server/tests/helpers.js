import { RoomManager } from '../src/rooms/RoomManager.js';

export class FakeTransport {
  events = []; joined = new Map();
  emitToRoom(code, ev, data) { this.events.push({ code, ev, data }); }
  emitToUser(id, ev, data) { this.events.push({ user: id, ev, data }); }
  join(id, code) { this.joined.set(id, code); }
  leave(id) { this.joined.delete(id); }
  closeRoom() {}
  of(ev) { return this.events.filter((e) => e.ev === ev); }
}
export const user = (n) => ({ id: `u${n}`, name: `Player${n}`, socketId: `s${n}` });
export function makeManager(config = {}) {
  const transport = new FakeTransport();
  const results = [];
  const manager = new RoomManager({ transport, config: { graceMs: 5000, resultsDelayMs: 5000, emptyRoomTtlMs: 5000, ...config }, onResult: (r) => results.push(r) });
  return { manager, transport, results };
}
/** Create a room with n players (host = u1). */
export function roomWith(n, opts = {}, config = {}) {
  const ctx = makeManager(config);
  const room = ctx.manager.createRoom(user(1), opts);
  for (let i = 2; i <= n; i++) ctx.manager.joinRoom(user(i), room.code);
  return { ...ctx, room };
}
export const readyAndStart = (room, hostId = 'u1') => {
  room.fighters.forEach((id) => room.setReady(id, true));
  room.startMatch(hostId);
};
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
