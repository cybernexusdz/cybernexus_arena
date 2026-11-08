import Phaser from 'phaser';
import { CHARACTER_ART, SFX, STAGE_ART } from '../assets/manifest.js';

/** Loads manifest assets (none by default — everything is procedural) then starts the fight. */
export class BootScene extends Phaser.Scene {
  constructor() { super('Boot'); }
  preload() {
    for (const art of Object.values(CHARACTER_ART)) {
      const s = art.sheet;
      if (s) this.load.spritesheet(s.key, s.url, { frameWidth: s.frameWidth, frameHeight: s.frameHeight });
    }
    for (const [name, url] of Object.entries(SFX)) if (url) this.load.audio(`sfx-${name}`, url);
    for (const [id, st] of Object.entries(STAGE_ART)) if (st.image) this.load.image(`stage-${id}`, st.image);
    this.load.on('loaderror', (f) => console.warn('asset failed to load:', f.key));
  }
  create() {
    for (const art of Object.values(CHARACTER_ART)) {
      const s = art.sheet; if (!s) continue;
      for (const [state, a] of Object.entries(s.anims || {})) {
        const key = `${s.key}-${state}`;
        if (!this.anims.exists(key)) this.anims.create({ key, frames: this.anims.generateFrameNumbers(s.key, { start: a.start, end: a.end }), frameRate: a.frameRate, repeat: a.repeat });
      }
    }
    this.scene.start('Fight');
  }
}
