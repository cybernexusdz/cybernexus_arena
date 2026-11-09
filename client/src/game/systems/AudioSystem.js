import { SFX } from '../assets/manifest.js';

// name -> [startFreq, endFreq, seconds, waveform, gain]
const SYNTH = {
  punch: [220, 90, 0.08, 'square', 0.18], kick: [160, 50, 0.13, 'sawtooth', 0.22], hit: [140, 40, 0.14, 'square', 0.3],
  special: [440, 70, 0.24, 'sawtooth', 0.26],
  block: [520, 300, 0.07, 'triangle', 0.2], ko: [260, 30, 0.7, 'sawtooth', 0.3], bell: [880, 880, 0.5, 'sine', 0.2], tick: [660, 660, 0.06, 'sine', 0.12],
};

/** Plays real files from the manifest when loaded, otherwise a synthesized placeholder. */
export class AudioSystem {
  constructor(scene, volume) { this.scene = scene; this.volume = Math.max(0, Math.min(1, volume / 100)); }
  play(name) {
    if (this.volume <= 0) return;
    const key = `sfx-${name}`;
    if (SFX[name] && this.scene.cache.audio.exists(key)) { this.scene.sound.play(key, { volume: this.volume }); return; }
    const ctx = this.scene.sound?.context, def = SYNTH[name];
    if (!ctx || !def) return;
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    const [f0, f1, dur, type, gain] = def, t = ctx.currentTime;
    const osc = ctx.createOscillator(), g = ctx.createGain();
    osc.type = type; osc.frequency.setValueAtTime(f0, t); osc.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    g.gain.setValueAtTime(gain * this.volume, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(g).connect(ctx.destination); osc.start(t); osc.stop(t + dur + 0.02);
  }
}
