import Phaser from 'phaser';
import { ARENA } from '@shared/sim.js';
import { CHARACTER_ART } from '../assets/manifest.js';
import { drawRig } from './rig.js';

/** One on-screen fighter. Procedural rig by default; real sprite sheet if the manifest defines one. */
export class FighterSprite {
  constructor(scene, characterId, depth = 5) {
    this.scene = scene;
    this.art = CHARACTER_ART[characterId] || CHARACTER_ART.azure;
    this.shadow = scene.add.ellipse(0, ARENA.floorY + 4, 70, 14, 0x000000, 0.4).setDepth(1);
    this.container = scene.add.container(0, ARENA.floorY).setDepth(depth);
    this.flashUntil = 0; this.lastState = null;
    if (this.art.sheet) {
      const s = this.art.sheet;
      this.sprite = scene.add.sprite(0, 0, s.key).setOrigin(0.5, 1).setScale(s.scale || 1);
      this.container.add(this.sprite);
    } else {
      this.g = scene.add.graphics();
      this.container.add(this.g);
    }
  }
  flash(ms = 90) { this.flashUntil = this.scene.time.now + ms; }

  /** view: {x,y,facing,state,frame} */
  apply(view, time) {
    const c = this.container;
    c.setPosition(view.x, view.y);
    const target = view.facing >= 0 ? 1 : -1;
    c.scaleX = Math.abs(c.scaleX - target) < 0.05 ? target : c.scaleX + (target - c.scaleX) * 0.45;
    const rot = !this.sprite && view.state === 'ko' ? -target * 1.45 : 0;
    c.rotation += (rot - c.rotation) * 0.35;
    const lift = Math.max(0, 1 - (ARENA.floorY - view.y) / 300);
    this.shadow.setPosition(view.x, ARENA.floorY + 4).setScale(lift, lift);
    if (this.sprite) {
      if (this.lastState !== view.state) {
        const key = `${this.art.sheet.key}-${view.state}`;
        this.sprite.play(this.scene.anims.exists(key) ? key : `${this.art.sheet.key}-idle`, true);
        this.lastState = view.state;
      }
    } else {
      drawRig(this.g, this.art.colors, view.state, view.frame, time, this.scene.time.now < this.flashUntil);
    }
  }
  destroy() { this.container.destroy(); this.shadow.destroy(); }
}
