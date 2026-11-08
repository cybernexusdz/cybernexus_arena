import { performance } from 'node:perf_hooks';
import { TICK_RATE } from '../../../shared/sim.js';

/** Fixed-timestep driver: calls manager.tick() 60x/sec with catch-up (bounded) after event-loop stalls. */
export class GameLoop {
  constructor(manager) { this.manager = manager; this.timer = null; }
  start() {
    const step = 1000 / TICK_RATE;
    let last = performance.now(), acc = 0;
    this.timer = setInterval(() => {
      const now = performance.now();
      acc = Math.min(acc + (now - last), 250); last = now;
      while (acc >= step) { acc -= step; try { this.manager.tick(); } catch (e) { console.error('tick error', e); } }
    }, 8);
  }
  stop() { clearInterval(this.timer); }
}
