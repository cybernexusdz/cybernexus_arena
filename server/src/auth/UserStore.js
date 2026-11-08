import fs from 'node:fs';
import path from 'node:path';

/** Minimal persistent user store (JSON file). Swap for a real DB behind the same interface. */
export class UserStore {
  constructor(file = ':memory:') {
    this.file = file; this.byName = new Map(); this.byId = new Map(); this.timer = null;
    if (file !== ':memory:' && fs.existsSync(file)) {
      try { for (const u of JSON.parse(fs.readFileSync(file, 'utf8'))) this.#index(u); }
      catch (e) { console.error('Could not read users file:', e.message); }
    }
  }
  #index(u) { this.byName.set(u.username.toLowerCase(), u); this.byId.set(u.id, u); }
  findByName(name) { return this.byName.get(String(name).toLowerCase()) || null; }
  findById(id) { return this.byId.get(id) || null; }
  create(u) { this.#index(u); this.save(); return u; }
  save() {
    if (this.file === ':memory:' || this.timer) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      try {
        fs.mkdirSync(path.dirname(this.file), { recursive: true });
        const tmp = this.file + '.tmp';
        fs.writeFileSync(tmp, JSON.stringify([...this.byId.values()]));
        fs.renameSync(tmp, this.file);
      } catch (e) { console.error('Could not save users:', e.message); }
    }, 500);
    this.timer.unref?.();
  }
}
