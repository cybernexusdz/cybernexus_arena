import Phaser from 'phaser';
import { DT } from '@shared/sim.js';
import { FighterSprite } from '../entities/FighterSprite.js';
import { createStage } from '../entities/StageRenderer.js';
import { Hud } from '../ui/Hud.js';
import { InputSystem } from '../systems/InputSystem.js';
import { AudioSystem } from '../systems/AudioSystem.js';
import { Effects } from '../systems/Effects.js';
import { SnapshotBuffer } from '../net/SnapshotBuffer.js';
import { Predictor } from '../net/Predictor.js';

const INTERP_DELAY_MS = 110;   // render remote fighters this far in the past for smooth interpolation
const SEND_EVERY_TICKS = 2;    // input batches at 30 Hz

/**
 * Renders the authoritative match. Fighters control only their own slot (via prediction);
 * spectators just interpolate server snapshots. All Socket.IO listeners are removed on shutdown/destroy.
 */
export class FightScene extends Phaser.Scene {
  constructor() { super('Fight'); }

  create() {
    this.bridge = this.registry.get('bridge');
    const { net, players, rules, localSlot, settings, touch } = this.bridge;
    this.net = net; this.localSlot = localSlot;
    this.buffer = new SnapshotBuffer();
    this.predictor = localSlot >= 0 ? new Predictor() : null;
    this.acc = 0; this.tickCount = 0; this.outbox = []; this.visual = null; this.lastPhase = null;
    this.unsubs = []; this.cleaned = false;

    createStage(this, rules.stage);
    this.sprites = players.map((p, i) => new FighterSprite(this, p.character, 5 + i));
    this.hud = new Hud(this, { players, rules, localSlot });
    this.audio = new AudioSystem(this, settings.volume);
    this.fx = new Effects(this, settings.shake);
    this.input_ = localSlot >= 0 ? new InputSystem(this, touch) : null;
    this.hud.waiting('Connecting to match…');

    this.unsubs.push(
      net.on('match:state', (s) => this.#onSnapshot(s)),
      net.on('match:event', (e) => this.#onEvent(e)),
    );
    const latest = this.bridge.initialSnapshot; if (latest) this.#onSnapshot(latest);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.#cleanup());
    this.events.once(Phaser.Scenes.Events.DESTROY, () => this.#cleanup());
  }

  #cleanup() {
    if (this.cleaned) return; this.cleaned = true;
    this.unsubs.forEach((off) => off()); this.unsubs = [];
    this.input_?.destroy();
    this.sprites?.forEach((s) => s.destroy());
  }

  #onSnapshot(s) {
    this.buffer.push(s);
    if (this.predictor) {
      const me = s.fighters[this.localSlot], opp = s.fighters[1 - this.localSlot];
      this.predictor.syncSeq(me.ack);
      this.predictor.reconcile(me, opp.x, s.phase === 'fighting');
    }
    if (s.phase !== this.lastPhase) { this.lastPhase = s.phase; this.hud.waiting(''); }
  }

  #onEvent(e) {
    const { players } = this.bridge;
    switch (e.type) {
      case 'roundStart': this.hud.announce(`ROUND ${e.round}`, { hold: 1500, size: 72 }); this.audio.play('bell'); break;
      case 'countdown': this.audio.play('tick'); this.hud.announce(String(e.n), { hold: 500, size: 110, color: '#ffc83d' }); break;
      case 'fight': this.hud.announce('FIGHT!', { color: '#ff3b4e', hold: 600 }); this.audio.play('bell'); break;
      case 'hit':
        this.fx.spark(e.x, e.y, 0xffe066, e.damage >= 10); this.sprites[e.defender]?.flash();
        this.audio.play(e.move === 'kick' ? 'kick' : 'punch'); this.audio.play('hit'); break;
      case 'block': this.fx.guard(e.x, e.y); this.audio.play('block'); break;
      case 'ko': this.fx.spark(e.x, e.y, 0xff3b4e, true); this.audio.play('ko'); break;
      case 'roundEnd': {
        const w = e.winner;
        const txt = e.reason === 'time' ? 'TIME!' : 'K.O.';
        this.hud.announce(txt, { color: '#ff3b4e', hold: 1300, sub: w === null ? 'DRAW' : `${players[w].name.toUpperCase()} WINS THE ROUND`, size: 100 });
        if (w !== null) this.sprites[w].flash(0); break;
      }
      case 'matchEnd': this.hud.announce('GAME!', { color: '#ffc83d', hold: 4000, size: 80, sub: `${players[e.winner].name.toUpperCase()} WINS` }); break;
      default: break;
    }
  }

  update(time, delta) {
    if (this.input_) { // fixed 60 Hz input + prediction
      this.acc += Math.min(delta, 100) / 1000;
      while (this.acc >= DT) { this.acc -= DT; this.#fixedTick(); }
    }
    const meta = this.#render(time);
    if (meta) this.hud.update(meta, this.net.rtt, this.bridge.settings.showPing);
  }

  #fixedTick() {
    const latest = this.buffer.latest;
    if (!latest || !this.predictor.synced || latest.phase === 'finished') return;
    const opp = latest.fighters[1 - this.localSlot];
    const bits = this.input_.poll();
    this.outbox.push(this.predictor.step(bits, opp.x, latest.phase === 'fighting'));
    if (++this.tickCount % SEND_EVERY_TICKS === 0) { this.net.sendInput(this.outbox); this.outbox = []; }
  }

  #render(time) {
    const sample = this.buffer.sample(this.net.serverNow() - INTERP_DELAY_MS);
    if (!sample) return null;
    sample.fighters.forEach((view, i) => {
      let v = view;
      if (i === this.localSlot && this.predictor.state && sample.meta.phase === 'fighting') {
        const p = this.predictor.state;
        // Smooth small corrections, snap on big ones (hits, round resets).
        if (!this.visual || Math.abs(this.visual.x - p.x) > 90 || Math.abs(this.visual.y - p.y) > 90) this.visual = { x: p.x, y: p.y };
        this.visual.x += (p.x - this.visual.x) * 0.5; this.visual.y += (p.y - this.visual.y) * 0.5;
        v = { ...p, x: this.visual.x, y: this.visual.y };
      } else if (i === this.localSlot) this.visual = null;
      this.sprites[i].apply(v, time);
    });
    return sample.meta;
  }
}
