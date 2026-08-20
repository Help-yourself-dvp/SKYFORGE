export class Dbg {
  constructor(game) {
    this.game = game;
    this._acc = 0;
    this.fps = 0;
    this.frameMs = 0;
    this._frames = 0;
    this._fpsAcc = 0;
    this.enabled = true;
    this.last = '';
    this.snapshot = null;
    this.prevSnapshot = null;
    this.watchdog = null;
    this.startedAt = performance.now();
  }

  collect() {
    const g = this.game;
    const info = g.gfx?.renderer?.info;
    const p = g.player?.position;
    return {
      t: Number(((performance.now() - this.startedAt) / 1000).toFixed(1)),
      fps: Number(this.fps.toFixed(1)),
      frame: Number(this.frameMs.toFixed(1)),
      state: g.state,
      bodies: g.physics?.sync?.entities?.length ?? 0,
      colliders: g.physics?.sync?.entities?.length ?? 0,
      joints: g.physics?.jointCount?.() ?? 0,
      threeObjects: g.gfx?.scene?.children?.length ?? 0,
      drawCalls: info?.render?.calls ?? 0,
      triangles: info?.render?.triangles ?? 0,
      particles: g.gfx?.particles?.items?.length ?? 0,
      audioNodes: g.audio?.activeNodes?.() ?? 0,
      sceneChildren: g.gfx?.scene?.children?.length ?? 0,
      animals: g.fauna?.animals?.length ?? 0,
      plants: g.flora?.plants?.length ?? 0,
      px: p ? Number(p.x.toFixed(2)) : null,
      py: p ? Number(p.y.toFixed(2)) : null,
      pz: p ? Number(p.z.toFixed(2)) : null,
    };
  }

  update(dt) {
    this.frameMs = dt * 1000;
    this._frames += 1;
    this._fpsAcc += dt;
    if (this._fpsAcc >= 0.4) {
      this.fps = this._frames / this._fpsAcc;
      this._frames = 0;
      this._fpsAcc = 0;
    }
    if (dt > 0.2) this.watchdog = this.snapshot;
    this._acc += dt;
    if (this._acc < 1) return;
    this._acc = 0;
    this.prevSnapshot = this.snapshot;
    this.snapshot = this.collect();
    const s = this.snapshot;
    this.last = [
      `DBG t=${s.t}`,
      `fps=${s.fps}`,
      `frame=${s.frame}`,
      `state=${s.state}`,
      `bodies=${s.bodies}`,
      `particles=${s.particles}`,
      `audioNodes=${s.audioNodes}`,
    ].join(' ');
    if (this.enabled) console.log(`[DBG] ${this.last}`);
  }
}
