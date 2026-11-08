import {
  TICK_RATE, INPUT, createFighter, stepFighter, separateFighters, resolveCombat, serializeFighter,
} from '../../../shared/sim.js';

const COUNTDOWN_TICKS = 3 * TICK_RATE;
const ROUND_OVER_TICKS = 2 * TICK_RATE;
const MAX_QUEUE = 15;        // buffered input frames per fighter (anti speed-hack back-pressure)
const MAX_SEQ_JUMP = 300;    // reject absurd sequence jumps
const STALE_LIMIT = 6;       // repeat held keys for at most this many ticks without new input
const SNAPSHOT_EVERY = 2;    // 30 Hz snapshots from a 60 Hz sim
const SPAWNS = [{ x: 300, facing: 1 }, { x: 660, facing: -1 }];

/**
 * Server-authoritative 1v1 match. Clients only ever send input bitmasks; every position,
 * hit and health value is computed here. Pure logic: call tick() at 60 Hz.
 */
export class Match {
  constructor({ players, rules, onSnapshot, onEvent, onEnd }) {
    this.players = players;           // [{id,name,character}, {id,name,character}]
    this.rules = rules;
    this.onSnapshot = onSnapshot; this.onEvent = onEvent; this.onEnd = onEnd;
    this.wins = [0, 0]; this.round = 0; this.tickCount = 0;
    this.finished = false; this.result = null;
    this.queues = [[], []]; this.lastSeq = [0, 0]; this.ack = [0, 0]; this.lastHeld = [0, 0]; this.stale = [0, 0];
    this.startRound();
  }

  startRound() {
    this.round++;
    const hp = this.rules.maxHealth;
    this.fighters = SPAWNS.map((s, i) => createFighter(i, s.x, s.facing, hp));
    this.phase = 'countdown'; this.phaseTicks = COUNTDOWN_TICKS;
    this.timeLeft = this.rules.roundTime * TICK_RATE;
    this.emit({ type: 'roundStart', round: this.round });
  }

  emit(e) { this.onEvent?.(e); }

  /** Validate + enqueue client input frames [{seq, bits}]. Returns number accepted. */
  pushInputs(slot, frames) {
    if (this.finished || !(slot === 0 || slot === 1) || !Array.isArray(frames)) return 0;
    let n = 0;
    for (const fr of frames.slice(0, 20)) {
      if (!fr || !Number.isInteger(fr.seq) || !Number.isInteger(fr.bits)) continue;
      if (fr.bits < 0 || fr.bits > INPUT.ALL) continue;
      if (fr.seq <= this.lastSeq[slot]) continue;              // replay / duplicate
      if (fr.seq - this.lastSeq[slot] > MAX_SEQ_JUMP) break;   // suspicious jump
      const q = this.queues[slot];
      if (q.length >= MAX_QUEUE) break;                         // can't run faster than 60 Hz
      q.push({ seq: fr.seq, bits: fr.bits });
      this.lastSeq[slot] = fr.seq; n++;
    }
    return n;
  }

  #nextInput(slot) {
    const fr = this.queues[slot].shift();
    if (fr) {
      this.ack[slot] = fr.seq; this.stale[slot] = 0;
      this.lastHeld[slot] = fr.bits & INPUT.HELD_MASK;
      return fr.bits;
    }
    return ++this.stale[slot] > STALE_LIMIT ? 0 : this.lastHeld[slot];
  }
  #discardInputs() { for (const s of [0, 1]) { const q = this.queues[s]; while (q.length) this.ack[s] = q.shift().seq; this.lastHeld[s] = 0; } }

  tick() {
    if (this.finished) return;
    this.tickCount++;
    const [a, b] = this.fighters;
    if (this.phase === 'countdown') {
      this.#discardInputs();
      if (this.phaseTicks % TICK_RATE === 0) this.emit({ type: 'countdown', n: this.phaseTicks / TICK_RATE });
      if (--this.phaseTicks <= 0) { this.phase = 'fighting'; this.emit({ type: 'fight' }); }
    } else if (this.phase === 'fighting') {
      stepFighter(a, this.#nextInput(0), b.x);
      stepFighter(b, this.#nextInput(1), a.x);
      separateFighters(a, b);
      for (const e of resolveCombat(a, b, this.rules)) this.emit(e);
      this.timeLeft--;
      if (a.hp <= 0 || b.hp <= 0) this.#endRound('ko');
      else if (this.timeLeft <= 0) this.#endRound('time');
    } else if (this.phase === 'roundOver') {
      this.#discardInputs();
      stepFighter(a, 0, b.x); stepFighter(b, 0, a.x);
      if (--this.phaseTicks <= 0) { if (this.#isOver()) this.#finish('score'); else this.startRound(); }
    }
    if (this.tickCount % SNAPSHOT_EVERY === 0) this.onSnapshot?.(this.snapshot());
  }

  #isOver() { const m = Math.max(...this.wins); return m >= this.rules.roundsToWin && this.wins[0] !== this.wins[1]; }

  #endRound(reason) {
    const [a, b] = this.fighters;
    let winner = null;
    if (a.hp > b.hp) winner = 0; else if (b.hp > a.hp) winner = 1;
    if (winner === null) { this.wins[0]++; this.wins[1]++; } else this.wins[winner]++;
    this.phase = 'roundOver'; this.phaseTicks = ROUND_OVER_TICKS;
    this.emit({ type: 'roundEnd', winner, reason, wins: [...this.wins], round: this.round });
  }

  #finish(reason, winnerSlot = this.wins[0] > this.wins[1] ? 0 : 1) {
    if (this.finished) return;
    this.finished = true; this.phase = 'finished';
    const w = this.players[winnerSlot], l = this.players[1 - winnerSlot];
    this.result = {
      reason, winnerSlot, winnerId: w.id, winnerName: w.name, winnerCharacter: w.character,
      loserId: l.id, loserName: l.name, loserCharacter: l.character, wins: [...this.wins], rounds: this.round,
    };
    this.emit({ type: 'matchEnd', winner: winnerSlot, reason });
    this.onSnapshot?.(this.snapshot());
    this.onEnd?.(this.result);
  }

  forfeit(slot, reason = 'forfeit') { if (!this.finished) this.#finish(reason, 1 - slot); }
  abort() { this.finished = true; this.phase = 'finished'; }

  snapshot() {
    return {
      t: Date.now(), tick: this.tickCount, phase: this.phase,
      count: this.phase === 'countdown' ? Math.ceil(this.phaseTicks / TICK_RATE) : 0,
      timer: Math.ceil(this.timeLeft / TICK_RATE), round: this.round, wins: [...this.wins],
      fighters: this.fighters.map((f, i) => ({ ...serializeFighter(f), ack: this.ack[i] })),
    };
  }
}
