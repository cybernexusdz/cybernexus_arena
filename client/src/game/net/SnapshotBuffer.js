const lerp = (a, b, t) => a + (b - a) * t;

/** Holds recent server snapshots and samples a smooth, slightly-in-the-past view for remote fighters/spectators. */
export class SnapshotBuffer {
  constructor(limit = 40) { this.snaps = []; this.limit = limit; }
  push(s) {
    const last = this.snaps.at(-1);
    if (last && s.t <= last.t) return;          // drop out-of-order
    this.snaps.push(s);
    if (this.snaps.length > this.limit) this.snaps.shift();
  }
  get latest() { return this.snaps.at(-1) || null; }
  /** renderTime in server-clock ms. Returns {meta, fighters:[view,view]} or null. */
  sample(renderTime) {
    const s = this.snaps;
    if (!s.length) return null;
    if (renderTime <= s[0].t) return this.#view(s[0], s[0], 0);
    for (let i = s.length - 1; i > 0; i--) {
      if (s[i - 1].t <= renderTime) {
        const a = s[i - 1], b = s[i];
        return this.#view(a, b, Math.min(1, Math.max(0, (renderTime - a.t) / Math.max(1, b.t - a.t))));
      }
    }
    return this.#view(s.at(-1), s.at(-1), 0);
  }
  #view(a, b, t) {
    const pick = t < 0.5 ? a : b, near = t < 0.5 ? 0 : 1;
    return {
      meta: pick,
      fighters: a.fighters.map((fa, i) => {
        const fb = b.fighters[i], d = near ? fb : fa;
        const teleport = Math.abs(fb.x - fa.x) > 200; // round reset
        return { ...d, x: teleport ? d.x : lerp(fa.x, fb.x, t), y: teleport ? d.y : lerp(fa.y, fb.y, t) };
      }),
    };
  }
}
