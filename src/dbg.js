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
    this.errors = [];
    this.startedAt = performance.now();
    this._trackTimers();
  }

  // Counts live setTimeout/setInterval so a runaway timer leak is visible in
  // the diagnostics. Patches globalThis once.
  _trackTimers() {
    if (globalThis.__skyTimers) return;
    globalThis.__skyTimers = { to: 0, iv: 0 };
    const g = globalThis;
    const origTO = g.setTimeout;
    const origIV = g.setInterval;
    const origCT = g.clearTimeout;
    const origCI = g.clearInterval;
    g.setTimeout = (fn, ms, ...a) => {
      globalThis.__skyTimers.to += 1;
      const id = origTO(() => { globalThis.__skyTimers.to -= 1; fn(); }, ms, ...a);
      return id;
    };
    g.setInterval = (fn, ms, ...a) => {
      globalThis.__skyTimers.iv += 1;
      const id = origIV(fn, ms, ...a);
      return id;
    };
    g.clearTimeout = (id) => { globalThis.__skyTimers.to = Math.max(0, globalThis.__skyTimers.to - 1); return origCT(id); };
    g.clearInterval = (id) => { globalThis.__skyTimers.iv = Math.max(0, globalThis.__skyTimers.iv - 1); return origCI(id); };
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
      bodies: g.physics?.bodyCount?.() ?? 0,
      colliders: g.physics?.colliderCount?.() ?? 0,
      joints: g.physics?.jointCount?.() ?? 0,
      threeObjects: g.gfx?.scene?.children?.length ?? 0,
      drawCalls: info?.render?.calls ?? 0,
      triangles: info?.render?.triangles ?? 0,
      particles: g.gfx?.particles?.items?.length ?? 0,
      timers: globalThis.__skyTimers ? globalThis.__skyTimers.to + globalThis.__skyTimers.iv : 0,
      audioNodes: g.audio?.activeNodes?.() ?? 0,
      sceneChildren: g.gfx?.scene?.children?.length ?? 0,
      animals: g.fauna?.animals?.length ?? 0,
      plants: g.flora?.plants?.length ?? 0,
      entities: g.physics?.sync?.entities?.length ?? 0,
      px: p ? Number(p.x.toFixed(2)) : null,
      py: p ? Number(p.y.toFixed(2)) : null,
      pz: p ? Number(p.z.toFixed(2)) : null,
    };
  }

  noteError(err) {
    this.errors.push({
      t: Number(((performance.now() - this.startedAt) / 1000).toFixed(1)),
      msg: (err && err.message) || String(err),
    });
    if (this.errors.length > 20) this.errors.shift();
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
    // Watchdog: a frame far longer than expected means the main thread was
    // blocked — keep the last known-good snapshot for post-mortem.
    if (dt > 0.25) this.watchdog = this.snapshot || this.collect();
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
      `colliders=${s.colliders}`,
      `joints=${s.joints}`,
      `threeObjects=${s.threeObjects}`,
      `drawCalls=${s.drawCalls}`,
      `triangles=${s.triangles}`,
      `particles=${s.particles}`,
      `timers=${s.timers}`,
      `audioNodes=${s.audioNodes}`,
    ].join(' ');
    if (this.enabled) console.log(`[DBG] ${this.last}`);
  }
}
