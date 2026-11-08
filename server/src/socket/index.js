import { TokenBucket } from '../util/rateLimit.js';
import { RoomError } from '../rooms/Room.js';

const errorPayload = (e) => {
  if (e instanceof RoomError) return { ok: false, error: { code: e.code, message: e.message } };
  console.error('[socket] unexpected error', e);
  return { ok: false, error: { code: 'INTERNAL', message: 'Something went wrong.' } };
};

/** Build the Transport the rooms layer uses to talk to sockets (kept separate so rooms are testable). */
export function createTransport(io) {
  return {
    emitToRoom: (code, ev, data, opts) => (opts?.volatile ? io.to('room:' + code).volatile : io.to('room:' + code)).emit(ev, data),
    emitToUser: (id, ev, data) => io.to('user:' + id).emit(ev, data),
    join: (id, code) => io.in('user:' + id).socketsJoin('room:' + code),
    leave: (id, code) => io.in('user:' + id).socketsLeave('room:' + code),
    closeRoom: (code) => io.in('room:' + code).socketsLeave('room:' + code),
  };
}

export function attachSocketServer(io, { auth, manager }) {
  io.use((socket, next) => {
    const user = auth.verifyToken(socket.handshake.auth?.token);
    if (!user) return next(new Error('UNAUTHORIZED'));
    socket.data.user = user; next();
  });

  io.on('connection', (socket) => {
    const user = socket.data.user;
    const actor = () => ({ id: user.id, name: user.name, socketId: socket.id });

    // One live session per account: newest connection wins.
    const existing = io.sockets.adapter.rooms.get('user:' + user.id);
    if (existing) for (const sid of existing) {
      const old = io.sockets.sockets.get(sid);
      if (old) { old.emit('session:replaced'); old.disconnect(true); }
    }
    socket.join('user:' + user.id);

    const general = new TokenBucket(30, 60);
    const inputs = new TokenBucket(90, 150);

    const handle = (event, fn) => socket.on(event, async (payload, cb) => {
      const ack = typeof cb === 'function' ? cb : () => {};
      try {
        if (!general.take()) return ack({ ok: false, error: { code: 'RATE_LIMITED', message: 'Slow down.' } });
        const data = await fn(payload && typeof payload === 'object' ? payload : {});
        ack({ ok: true, ...(data || {}) });
      } catch (e) { ack(errorPayload(e)); }
    });
    const mustBeInRoom = () => {
      const room = manager.getRoomOf(user.id);
      if (!room) throw new RoomError('NOT_IN_ROOM', 'You are not in a room.');
      return room;
    };

    socket.on('clock:sync', (_t, cb) => typeof cb === 'function' && cb({ ok: true, serverTime: Date.now() }));
    socket.on('input', (payload) => {          // hot path: no ack, own rate limit, strict validation in Match
      if (!inputs.take() || !payload || !Array.isArray(payload.frames)) return;
      manager.getRoomOf(user.id)?.handleInput(user.id, payload.frames);
    });

    handle('rooms:list', () => ({ rooms: manager.listPublic() }));
    handle('room:create', (p) => ({ room: manager.createRoom(actor(), { name: p.name, isPrivate: p.isPrivate === true, rules: p.rules }).toPublic() }));
    handle('room:join', (p) => ({ room: manager.joinRoom(actor(), p.code).toPublic() }));
    handle('room:leave', () => { manager.leaveRoom(user.id); socket.emit('room:left'); });
    handle('room:ready', (p) => { mustBeInRoom().setReady(user.id, p.ready === true); });
    handle('room:character', (p) => { mustBeInRoom().setCharacter(user.id, p.character); });
    handle('room:rules', (p) => { mustBeInRoom().updateRules(user.id, p.rules); });
    handle('room:start', () => { mustBeInRoom().startMatch(user.id); });
    handle('room:continue', () => {
      const room = mustBeInRoom();
      if (room.hostId !== user.id) throw new RoomError('NOT_HOST', 'Only the host can do that.');
      room.advance();
    });
    handle('room:kick', (p) => { mustBeInRoom().kick(user.id, String(p.playerId)); });

    socket.on('disconnect', () => manager.handleDisconnect(user.id, socket.id));

    // Reconnect / refresh: put the player back in their seat and resync everything.
    const room = manager.handleConnect(actor());
    if (room) {
      socket.emit('room:state', room.toPublic());
      if (room.match && !room.match.finished) socket.emit('match:state', room.match.snapshot());
    } else socket.emit('room:none');
  });
}
