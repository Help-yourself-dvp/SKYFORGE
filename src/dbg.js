export class Dbg {
  constructor(game) {
    this.game = game;
    this._acc = 0;
    this.fps = 0;
    this._frames = 0;
    this._fpsAcc = 0;
    this.enabled = true;
  }

  update(dt) {
    this._frames += 1;
    this._fpsAcc += dt;
    if (this._fpsAcc >= 0.4) {
      this.fps = this._frames / this._fpsAcc;
      this._frames = 0;
      this._fpsAcc = 0;
    }
    this._acc += dt;
    if (this._acc < 1) return;
    this._acc = 0;
    if (!this.enabled) return;
    const g = this.game;
    const p = g.player?.position;
    const bodies = g.physics?.bodyCount?.() ?? 0;
    const line = [
      `SKY ${g.version}`,
      `st=${g.state}`,
      `fps=${this.fps.toFixed(1)}`,
      p ? `p=${p.x.toFixed(1)},${p.y.toFixed(1)},${p.z.toFixed(1)}` : 'p=?',
      `bodies=${bodies}`,
      `tod=${(g.daynight?.timeOfDay ?? 0).toFixed(3)}`,
      `q=${g.qualityName}`,
    ].join(' | ');
    console.log(`[DBG] ${line}`);
    this.last = line;
  }
}
