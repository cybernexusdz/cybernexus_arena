import Phaser from 'phaser';
import { ARENA } from '@shared/sim.js';
import { BootScene } from './scenes/BootScene.js';
import { FightScene } from './scenes/FightScene.js';

/** Create a Phaser game inside `parent`. The `bridge` object is the React → Phaser contract. */
export function createGame(parent, bridge) {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: ARENA.width,
    height: ARENA.height,
    backgroundColor: '#0b0d16',
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    fps: { target: 60 },
    render: { antialias: true },
    scene: [BootScene, FightScene],
    callbacks: { preBoot: (game) => game.registry.set('bridge', bridge) },
  });
}
