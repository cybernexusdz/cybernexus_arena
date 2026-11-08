import { stepFighter, cloneFighter } from '@shared/sim.js';

/**
 * Client-side prediction + server reconciliation for the LOCAL fighter only.
 * The server consumes exactly one input frame per tick and reports the last frame it consumed (`ack`).
 * On every snapshot we restart from the authoritative state and replay all unacknowledged frames, so
 * movement/attacks feel instant yet always converge to what the server decided.
 */
export class Predictor {
  constructor() { this.seq = 0; this.pending = []; this.state = null; this.synced = false; }
  /** Continue numbering from where the server left off (needed after a reconnect). */
  syncSeq(ack) { if (!this.synced) { this.seq = ack; this.synced = true; } }
  step(bits, oppX, active) {
    const frame = { seq: ++this.seq, bits };
    this.pending.push(frame);
    if (this.pending.length > 90) this.pending.shift();
    if (this.state && active) stepFighter(this.state, bits, oppX);
    return frame;
  }
  reconcile(serverFighter, oppX, active) {
    this.pending = this.pending.filter((f) => f.seq > serverFighter.ack);
    this.state = cloneFighter(serverFighter);
    if (active) for (const f of this.pending) stepFighter(this.state, f.bits, oppX);
  }
}
