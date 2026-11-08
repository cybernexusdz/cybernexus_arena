/** Hit sparks, dust and shake. All objects self-destruct via tween callbacks. */
export class Effects {
  constructor(scene, shakeEnabled) { this.scene = scene; this.shake = shakeEnabled; }
  spark(x, y, color = 0xffe066, big = false) {
    const s = this.scene, n = big ? 12 : 7;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.5, d = (big ? 70 : 45) * (0.6 + Math.random() * 0.6);
      const r = s.add.rectangle(x, y, big ? 28 : 18, 3, color).setRotation(a).setDepth(60);
      s.tweens.add({ targets: r, x: x + Math.cos(a) * d, y: y + Math.sin(a) * d, alpha: 0, scaleX: 0.2, duration: 260, onComplete: () => r.destroy() });
    }
    const ring = s.add.circle(x, y, 8, 0xffffff, 0.9).setDepth(61);
    s.tweens.add({ targets: ring, scale: big ? 4.5 : 3, alpha: 0, duration: 180, onComplete: () => ring.destroy() });
    if (big && this.shake) s.cameras.main.shake(140, 0.006);
    else if (this.shake) s.cameras.main.shake(70, 0.002);
  }
  guard(x, y) { this.spark(x, y, 0x7fd7ff, false); }
  dust(x, y) {
    for (let i = 0; i < 4; i++) {
      const c = this.scene.add.circle(x + (Math.random() - 0.5) * 30, y, 5 + Math.random() * 4, 0xcccccc, 0.4).setDepth(2);
      this.scene.tweens.add({ targets: c, y: y - 18, alpha: 0, scale: 2, duration: 350, onComplete: () => c.destroy() });
    }
  }
}
