import { CHARACTERS } from '@shared/protocol.js';

const FONT = '"Russo One", Impact, "Arial Black", sans-serif';
const BAR_W = 390, BAR_H = 24, BAR_Y = 26, MARGIN = 36;
const hex = (c) => parseInt(c.slice(1), 16);

/** In-canvas HUD: health bars (with damage-lag ghost), timer, round pips, announcements, role + ping. */
export class Hud {
  constructor(scene, { players, rules, localSlot }) {
    this.scene = scene; this.rules = rules; this.localSlot = localSlot;
    this.g = scene.add.graphics().setDepth(100);
    this.ghost = [1, 1]; this.colors = players.map((p) => hex(CHARACTERS.find((c) => c.id === p.character)?.color || '#ffffff'));
    const t = (x, y, s, o = {}) => scene.add.text(x, y, s, { fontFamily: FONT, fontSize: '18px', color: '#f3ecdc', ...o }).setDepth(101);
    this.names = [
      t(MARGIN, BAR_Y + BAR_H + 6, players[0].name.toUpperCase()),
      t(960 - MARGIN, BAR_Y + BAR_H + 6, players[1].name.toUpperCase()).setOrigin(1, 0),
    ];
    this.timer = t(480, 14, '60', { fontSize: '44px', stroke: '#000', strokeThickness: 5 }).setOrigin(0.5, 0);
    this.round = t(480, 62, '', { fontSize: '14px', color: '#ffc83d' }).setOrigin(0.5, 0);
    this.role = t(480, 516, '', { fontSize: '15px', color: '#9fb0c8' }).setOrigin(0.5, 0.5);
    this.ping = t(948, 516, '', { fontSize: '12px', color: '#9fb0c8' }).setOrigin(1, 0.5);
    this.banner = t(480, 220, '', { fontSize: '92px', stroke: '#000', strokeThickness: 10 }).setOrigin(0.5).setAlpha(0);
    this.sub = t(480, 290, '', { fontSize: '22px', color: '#ffc83d', stroke: '#000', strokeThickness: 4 }).setOrigin(0.5).setAlpha(0);
    this.status = t(480, 270, '', { fontSize: '22px', color: '#9fb0c8' }).setOrigin(0.5).setDepth(102);
    const label = localSlot >= 0 ? `YOU ARE P${localSlot + 1}  ·  A/D move  W jump  S block  J punch  K kick` : 'SPECTATING';
    this.role.setText(label);
  }

  update(meta, ping, showPing) {
    const [f0, f1] = meta.fighters, max = this.rules.maxHealth, g = this.g;
    g.clear();
    [f0, f1].forEach((f, i) => {
      const x = i === 0 ? MARGIN : 960 - MARGIN - BAR_W, pct = Math.max(0, f.hp / max);
      this.ghost[i] = pct < this.ghost[i] ? this.ghost[i] + (pct - this.ghost[i]) * 0.05 : pct;
      g.fillStyle(0x0b0d16, 0.85); g.fillRect(x - 4, BAR_Y - 4, BAR_W + 8, BAR_H + 8);
      const fill = (w, color) => { const ww = BAR_W * w; g.fillStyle(color, 1); g.fillRect(i === 0 ? x : x + BAR_W - ww, BAR_Y, ww, BAR_H); };
      fill(this.ghost[i], 0xf3ecdc);
      fill(pct, pct > 0.5 ? 0x36e28a : pct > 0.25 ? 0xffc83d : 0xff3b4e);
      g.lineStyle(3, this.colors[i], 1); g.strokeRect(x - 4, BAR_Y - 4, BAR_W + 8, BAR_H + 8);
      for (let k = 0; k < this.rules.roundsToWin; k++) { // round pips
        const cx = i === 0 ? x + 8 + k * 22 : x + BAR_W - 8 - k * 22, cy = BAR_Y + BAR_H + 38;
        g.fillStyle(k < meta.wins[i] ? 0xffc83d : 0x2a3148, 1); g.fillCircle(cx, cy, 7);
      }
    });
    this.timer.setText(String(Math.max(0, meta.timer)).padStart(2, '0')).setColor(meta.timer <= 10 ? '#ff3b4e' : '#f3ecdc');
    this.round.setText(`ROUND ${meta.round}`);
    this.ping.setText(showPing ? `${ping} ms` : '');
    this.status.setText('');
  }
  waiting(text) { this.status.setText(text); }

  announce(text, { color = '#f3ecdc', sub = '', hold = 700, size = 92 } = {}) {
    const s = this.scene;
    this.banner.setText(text).setColor(color).setFontSize(size).setAlpha(1).setScale(1.7);
    this.sub.setText(sub).setAlpha(sub ? 1 : 0);
    s.tweens.killTweensOf([this.banner, this.sub]);
    s.tweens.add({ targets: this.banner, scale: 1, duration: 160, ease: 'Back.easeOut' });
    s.tweens.add({ targets: [this.banner, this.sub], alpha: 0, delay: hold, duration: 300 });
  }
}
