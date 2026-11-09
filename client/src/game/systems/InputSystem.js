import Phaser from 'phaser';
import { INPUT } from '@shared/sim.js';

const K = Phaser.Input.Keyboard.KeyCodes;

const HELD = [
  [INPUT.LEFT, [K.A, K.LEFT]], [INPUT.RIGHT, [K.D, K.RIGHT]], [INPUT.JUMP, [K.W, K.UP, K.SPACE]], [INPUT.BLOCK, [K.S, K.DOWN, K.SHIFT]],
];
const PRESS = [[INPUT.PUNCH, [K.J, K.Z]], [INPUT.KICK, [K.K, K.X]]];

/** Keyboard + on-screen (touch) input → one input bitmask per fixed tick. Attacks are edge-triggered. */
export class InputSystem {
  constructor(scene, touch) {
    this.touch = touch; this.pendingPress = 0; this.keys = []; this.destroyed = false;
    const kb = scene.input.keyboard;
    this.kb = kb;
    const all = [...HELD, ...PRESS].flatMap(([, codes]) => codes);
    kb.addCapture(all);
    for (const [bit, codes] of HELD) for (const c of codes) this.keys.push({ bit, key: kb.addKey(c) });
    this.onDown = (ev) => {
      if (ev.repeat) return;
      for (const [bit, codes] of PRESS) if (codes.includes(ev.keyCode)) this.pendingPress |= bit;
    };
    kb.on('keydown', this.onDown);
  }
  poll() {
    let bits = this.pendingPress | this.touch.press | this.touch.held;
    for (const { bit, key } of this.keys) if (key.isDown) bits |= bit;
    this.pendingPress = 0; this.touch.press = 0;
    if ((bits & INPUT.LEFT) && (bits & INPUT.RIGHT)) bits &= ~(INPUT.LEFT | INPUT.RIGHT);
    return bits;
  }
  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.kb.off('keydown', this.onDown);
    for (const { key } of this.keys) this.kb.removeKey(key);
    if (this.kb.manager) this.kb.removeCapture([...HELD, ...PRESS].flatMap(([, codes]) => codes));
    this.keys = [];
  }
}
