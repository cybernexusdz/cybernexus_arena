import Phaser from 'phaser';
import { ARENA } from '@shared/sim.js';
import { STAGE_ART } from '../assets/manifest.js';

/** Procedural parallax backdrop. Provide `image` in the manifest to use a real background instead. */
export function createStage(scene, stageId) {
  const art = STAGE_ART[stageId] || STAGE_ART.dojo;
  const { width: W, height: H, floorY } = ARENA;
  if (art.image) { scene.add.image(W / 2, H / 2, `stage-${stageId}`).setDepth(-10); return; }
  const g = scene.add.graphics().setDepth(-10);
  const bands = 24;
  for (let i = 0; i < bands; i++) { // vertical sky gradient
    const t = i / (bands - 1);
    const c = Phaser.Display.Color.Interpolate.ColorWithColor(
      Phaser.Display.Color.IntegerToColor(art.sky[0]), Phaser.Display.Color.IntegerToColor(art.sky[1]), 1, t);
    g.fillStyle(Phaser.Display.Color.GetColor(c.r, c.g, c.b), 1);
    g.fillRect(0, (floorY * i) / bands, W, floorY / bands + 1);
  }
  g.fillStyle(art.sun, 0.9); g.fillCircle(W * 0.72, 150, 70);
  g.fillStyle(art.sun, 0.15); g.fillCircle(W * 0.72, 150, 110);
  const skyline = (color, base, seed, minH, maxH) => { // silhouette blocks
    g.fillStyle(color, 1);
    let x = -20, s = seed;
    while (x < W) {
      s = (s * 9301 + 49297) % 233280; const w = 50 + (s % 70);
      s = (s * 9301 + 49297) % 233280; const h = minH + (s % (maxH - minH));
      g.fillRect(x, base - h, w, h + 10); x += w + 6;
    }
  };
  skyline(art.far, floorY - 40, 7, 60, 190);
  skyline(art.near, floorY - 10, 31, 30, 110);
  g.fillStyle(art.floor, 1); g.fillRect(0, floorY, W, H - floorY);
  g.lineStyle(3, art.line, 0.9); g.beginPath(); g.moveTo(0, floorY); g.lineTo(W, floorY); g.strokePath();
  g.lineStyle(1, art.line, 0.25); // perspective grid
  for (let i = -8; i <= 8; i++) { g.beginPath(); g.moveTo(W / 2 + i * 40, floorY); g.lineTo(W / 2 + i * 150, H); g.strokePath(); }
  for (let i = 1; i < 5; i++) { const y = floorY + i * i * 3.2; g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.strokePath(); }
}
