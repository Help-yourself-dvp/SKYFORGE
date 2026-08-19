export class Growth {
  constructor() {
    this.acc = 0;
  }

  update(dt, plants) {
    this.acc += dt;
    if (this.acc < 1.6) return;
    const step = this.acc;
    this.acc = 0;
    for (const p of plants) {
      if (p.dead) continue;
      if (p.crushed && p.stage > 0) {
        p.stage = Math.max(0, p.stage - 0.4);
        p.crushed = false;
        p.dirty = true;
        continue;
      }
      p.age = (p.age || 0) + step;
      if (p.stage < 3 && p.age > 28 + (p.id.charCodeAt(p.id.length - 1) % 12)) {
        p.stage = Math.min(3, p.stage + 0.25);
        p.dirty = true;
      }
    }
  }
}
