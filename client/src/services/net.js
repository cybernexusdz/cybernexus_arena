import { io } from 'socket.io-client';

const URL = import.meta.env.VITE_SERVER_URL || undefined;
const SERVER_EVENTS = ['room:state', 'room:none', 'room:left', 'room:closed', 'room:kicked', 'room:notice', 'room:rotated',
  'match:state', 'match:event', 'match:result', 'session:replaced'];

/** Singleton Socket.IO wrapper: stable event bus, promise requests, clock sync + latency. */
class NetService {
  constructor() {
    this.socket = null; this.handlers = new Map(); this.status = 'disconnected';
    this.offset = 0; this.rtt = 0; this.samples = []; this.syncTimer = null; this.hasConnected = false;
  }
  connect(token) {
    this.disconnect();
    this.hasConnected = false;
    const s = this.socket = io(URL, { auth: { token }, transports: ['websocket', 'polling'], tryAllTransports: true, reconnectionDelayMax: 3000 });
    this.#setStatus('connecting');
    s.on('connect', () => {
      const reconnected = this.hasConnected;
      this.hasConnected = true;
      this.#setStatus('connected'); this.samples = []; this.#sync(); this.#burstSync();
      if (reconnected) this.#emit('reconnected');
    });
    s.on('disconnect', () => this.#setStatus('disconnected'));
    s.io.on('reconnect_attempt', () => this.#setStatus('connecting'));
    s.on('connect_error', (e) => { this.#setStatus('disconnected'); if (e.message === 'UNAUTHORIZED') this.#emit('auth:invalid'); });
    for (const ev of SERVER_EVENTS) s.on(ev, (data) => this.#emit(ev, data));
    clearInterval(this.syncTimer);
    this.syncTimer = setInterval(() => this.#sync(), 4000);
  }
  disconnect() {
    clearInterval(this.syncTimer);
    if (this.socket) { this.socket.removeAllListeners(); this.socket.io.removeAllListeners(); this.socket.disconnect(); this.socket = null; }
    this.#setStatus('disconnected');
  }
  #setStatus(s) { if (s !== this.status) { this.status = s; this.#emit('status', s); } }
  #emit(ev, data) { this.handlers.get(ev)?.forEach((fn) => { try { fn(data); } catch (e) { console.error(`handler for ${ev} failed`, e); } }); }
  /** Subscribe; returns an unsubscribe function (use it in effect/scene cleanup). */
  on(ev, fn) {
    if (!this.handlers.has(ev)) this.handlers.set(ev, new Set());
    this.handlers.get(ev).add(fn);
    return () => this.handlers.get(ev)?.delete(fn);
  }
  request(event, payload = {}, timeoutMs = 8000) {
    return new Promise((resolve, reject) => {
      if (!this.socket?.connected) return reject(new Error('Not connected to the server.'));
      this.socket.timeout(timeoutMs).emit(event, payload, (err, res) => {
        if (err) return reject(new Error('The server did not respond in time.'));
        if (res?.ok === false) return reject(Object.assign(new Error(res.error?.message || 'Request failed'), { code: res.error?.code }));
        resolve(res);
      });
    });
  }
  sendInput(frames) { this.socket?.volatile.emit('input', { frames }); }

  // ---- clock sync: offset = serverTime - clientTime, from the lowest-RTT recent samples
  #sync() {
    if (!this.socket?.connected) return;
    const t0 = Date.now();
    this.socket.timeout(2000).emit('clock:sync', t0, (err, res) => {
      if (err || !res?.ok) return;
      const t1 = Date.now(), rtt = t1 - t0;
      this.samples.push({ rtt, offset: res.serverTime + rtt / 2 - t1 });
      if (this.samples.length > 8) this.samples.shift();
      const best = this.samples.reduce((a, b) => (b.rtt < a.rtt ? b : a));
      this.offset = best.offset; this.rtt = Math.round(this.samples.at(-1).rtt);
      this.#emit('latency', this.rtt);
    });
  }
  #burstSync() { for (let i = 1; i <= 4; i++) setTimeout(() => this.#sync(), i * 150); }
  serverNow() { return Date.now() + this.offset; }
}
export const net = new NetService();
