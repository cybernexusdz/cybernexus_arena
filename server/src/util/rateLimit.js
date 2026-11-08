/** Token bucket: `rate` tokens/second, up to `burst` stored. */
export class TokenBucket {
  constructor(rate, burst, now = () => Date.now()) { this.rate = rate; this.burst = burst; this.tokens = burst; this.now = now; this.last = now(); }
  take() {
    const t = this.now();
    this.tokens = Math.min(this.burst, this.tokens + ((t - this.last) / 1000) * this.rate);
    this.last = t;
    if (this.tokens < 1) return false;
    this.tokens -= 1; return true;
  }
}
/** Tiny fixed-window per-IP limiter for Express. */
export function ipLimiter(max, windowMs) {
  const hits = new Map();
  setInterval(() => { const n = Date.now(); for (const [k, v] of hits) if (v.reset < n) hits.delete(k); }, windowMs).unref();
  return (req, res, next) => {
    const key = req.ip, n = Date.now();
    let h = hits.get(key);
    if (!h || h.reset < n) { h = { count: 0, reset: n + windowMs }; hits.set(key, h); }
    if (++h.count > max) return res.status(429).json({ error: 'Too many requests, slow down.' });
    next();
  };
}
