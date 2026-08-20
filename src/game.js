import * as THREE from 'three';
import {
  VERSION, DEFAULT_SEED, STATES, parseQuery, parseShot, TOASTS, PROGRESS, PLAYER,
} from './config.js';
import { createRng, createNoise2D } from './rng.js';
import { Gfx } from './gfx/renderer.js';
import { initRapier, PhysicsWorld } from './physics/world.js';
import { Input } from './input.js';
import { AudioSys } from './audio.js';
import { Dbg } from './dbg.js';
import { HUD } from './ui/hud.js';
import { loadSave, writeSave, emptySave, clearSave } from './save.js';
import { emptyInventory, grant } from './craft/resources.js';
import { tryCraft } from './ui/crafting.js';
import { emptyBuildStock, grantPart } from './build/inventory.js';
import { Archipelago } from './world/archipelago.js';
import { Workshop } from './world/workshop.js';
import { Flora } from './world/flora.js';
import { Resources } from './world/resources.js';
import { Fauna } from './world/fauna.js';
import { Enemies } from './world/enemies.js';
import { DayNight } from './world/daynight.js';
import { Weather } from './world/weather.js';
import { Wind } from './sim/wind.js';
import { Growth } from './sim/growth.js';
import { Player } from './player/player.js';
import { GameCamera } from './player/camera.js';
import { Interact } from './player/interact.js';
import { Survival } from './player/survival.js';
import { MachineSystem } from './build/machine.js';
import { BuildController } from './build/ghost_ctrl.js';
import { InventoryView } from './ui/inventory.js';

const _amb = { x: 0, y: 7, z: 0 };
const _ambV = { x: 0, y: 0.15, z: 0 };
const _hintV = new THREE.Vector3();
const _fireP = new THREE.Vector3();

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.version = VERSION;
    this.state = STATES.BOOT;
    this.prevState = STATES.BOOT;
    this.seed = DEFAULT_SEED;
    this.query = parseQuery();
    this.shot = parseShot();
    this.time = 0;
    this.simPaused = true;
    this.disposed = false;
    this.raf = 0;
    this.last = 0;
    this.introToasts = 0;
    this.driven = 0;
    this.placed = [];
    this.unlocks = {};
    this.progress = { fruit: 0, trees: 0, driven: 0, nightFire: 0 };
    this.tools = [];
    this.inventory = emptyInventory();
    this.buildStock = emptyBuildStock();
    this.hasTorch = false;
    this.hasLantern = false;
    this.seenHorizon = 0;
    this.autosaveT = 0;
    this.qualityName = 'HIGH';
    this.portraitLocked = false;
    this._bootToasts = [];
  }

  async init() {
    await initRapier();
    this.gfx = new Gfx(this.canvas);
    if (this.query.quality) this.gfx.setQuality(this.query.quality);
    this.qualityName = this.gfx.qualityName;
    this.input = new Input(document.getElementById('ui-root'));
    this.audio = new AudioSys();
    this.physics = new PhysicsWorld();
    this.physics.debug = this.query.phys;
    this.daynight = new DayNight();
    this.daynight.speed = this.query.daySpeed;
    this.cam = new GameCamera(this.gfx.camera, this);
    this.dbg = new Dbg(this);
    this._loadOrNew(false);
    this.ui = new HUD(this, document.getElementById('ui-root'));
    this.invView = new InventoryView(this);
    window.addEventListener('resize', () => this.gfx.resize());
    this.gfx.resize();
    if (this.shot) this.applyShot(this.shot);
    else this.setState(STATES.TITLE);
    this.ui.toast(TOASTS.move);
    this._bootToasts = [TOASTS.matter, TOASTS.bench];
  }

  _systemsFromSeed(seed, save) {
    this.seed = seed || DEFAULT_SEED;
    this.rng = createRng(this.seed);
    this.noise = createNoise2D(this.rng);
    this.wind = new Wind(this.rng);
    this.weather = new Weather(this.rng);
    this.growth = new Growth();
    this.world = new Archipelago(this.rng, this.noise).build(this.gfx.scene);
    this.physics.pond = this.world.main.pond;
    this.physics.waterLevel = this.world.main.pond.level;
    this.world.main.addCollider(this.physics);
    this._waterSensor();
    this.gfx.initWorld(this.world.main.pond);
    this.workshop = new Workshop(this, new THREE.Vector3(
      this.world.main.workshop.x,
      this.world.heightAt(this.world.main.workshop.x, this.world.main.workshop.z),
      this.world.main.workshop.z,
    ));
    this.flora = new Flora(this);
    this.flora.generate(this.world.main, this.rng);
    this.resources = new Resources(this);
    this.resources.generate(this.world.main, this.rng, save?.world?.cutTrees || []);
    this.fauna = new Fauna(this);
    this.fauna.generate(this.world.main, this.rng);
    this.enemies = new Enemies(this);
    this.player = new Player(this);
    this.interact = new Interact(this);
    this.survival = new Survival(this);
    this.survival.enabled = this.query.survival;
    this.machine = new MachineSystem(this);
    this.build = new BuildController(this);
    this.workshop.spawnCrates();
    const spawn = new THREE.Vector3(
      this.world.main.workshop.x + 2.2,
      this.world.heightAt(this.world.main.workshop.x + 2.2, this.world.main.workshop.z + 3.4) + 0.2,
      this.world.main.workshop.z + 3.4,
    );
    this.player.setPosition(spawn.x, spawn.y, spawn.z);
    this.player.lastSafe.copy(spawn);
    if (save) this.applySave(save);
    else {
      this.daynight.setTime(0.28);
    }
    // Prime the broad phase so raycasts work from the very first frame
    // (including the paused title screen).
    this.physics.warm();
  }

  _waterSensor() {
    const pond = this.world.main.pond;
    const body = this.physics.world.createRigidBody(
      this.physics.R.RigidBodyDesc.fixed().setTranslation(pond.x, pond.level - 0.8, pond.z),
    );
    const col = this.physics.R.ColliderDesc.cylinder(1.2, pond.radius).setSensor(true);
    this.physics.world.createCollider(col, body);
  }

  _loadOrNew(forceNew) {
    const save = forceNew ? null : loadSave();
    this.inventory = save?.inventory ? { ...emptyInventory(), ...save.inventory } : emptyInventory();
    this.tools = save?.tools ? [...save.tools] : [];
    this.unlocks = save?.unlocks ? { ...save.unlocks } : {};
    this.buildStock = save?.buildStock ? { ...emptyBuildStock(), ...save.buildStock } : emptyBuildStock();
    this.progress = save?.progress ? { ...this.progress, ...save.progress } : this.progress;
    this.hasTorch = this.tools.includes('torch');
    this.hasLantern = this.tools.includes('lantern');
    this._systemsFromSeed(save?.seed || DEFAULT_SEED, save);
  }

  applySave(save) {
    if (save.timeOfDay != null) this.daynight.setTime(save.timeOfDay);
    if (save.weather) this.weather.set(save.weather);
    if (save.player) {
      this.player.setPosition(save.player.x, save.player.y, save.player.z);
      this.player.yaw = save.player.yaw || 0;
      this.survival.apply(save.player);
    }
    if (save.lastSafePos) this.player.lastSafe.copy(save.lastSafePos);
    if (save.machines && save.machines[0]) this.machine.restore(save.machines[0]);
    this.seenHorizon = save.world?.seenHorizon || 0;
    this.hasTorch = this.tools.includes('torch');
    this.hasLantern = this.tools.includes('lantern');
  }

  collectSave() {
    const p = this.player.position;
    return {
      version: VERSION,
      seed: this.seed,
      timeOfDay: this.daynight.timeOfDay,
      weather: this.weather.state,
      player: {
        x: p.x, y: p.y, z: p.z, yaw: this.player.yaw,
        health: this.survival.health, hunger: this.survival.hunger, thirst: this.survival.thirst,
      },
      inventory: { ...this.inventory },
      tools: [...this.tools],
      unlocks: { ...this.unlocks },
      buildStock: { ...this.buildStock },
      machines: [this.machine.serialize()],
      world: {
        cutTrees: [...this.resources.cut],
        plantStages: Object.fromEntries(this.flora.plants.map((pl) => [pl.id, pl.stage])),
        seenHorizon: this.seenHorizon,
      },
      lastSafePos: { x: this.player.lastSafe.x, y: this.player.lastSafe.y, z: this.player.lastSafe.z },
      progress: { ...this.progress },
    };
  }

  saveNow() {
    writeSave(this.collectSave());
  }

  start() {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.last = performance.now();
    this._frameErrors = 0;
    const loop = (now) => {
      if (this.disposed) return;
      const dt = Math.min(0.05, Math.max(0, (now - this.last) / 1000));
      this.last = now;
      try {
        this.update(dt);
        this.render();
      } catch (err) {
        // A single bad frame must never kill the game on a phone: the RAF
        // chain would stop and the app would appear frozen. Log once per
        // unique message, keep looping.
        const msg = (err && err.message) || String(err);
        if (msg !== this._lastErrMsg) {
          this._lastErrMsg = msg;
          console.error('[SKY] frame error (loop kept alive):', err);
          this.dbg?.noteError?.(err);
        }
        this._frameErrors += 1;
        // Persistent failure (same subsystem every frame): try to drop to a
        // plain render so the world stays visible instead of a black screen.
        if (this._frameErrors > 90 && this.gfx?.post) this.gfx.post.enabled = false;
      }
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  getDiagnostics() {
    return this.dbg?.collect?.() || null;
  }

  setState(s) {
    this.prevState = this.state;
    this.state = s;
    this.simPaused = s === STATES.PAUSE || s === STATES.TITLE || this.portraitLocked;
    if (s === STATES.PAUSE || s === STATES.TITLE) this.physics.setPaused(true);
    else if (s === STATES.INVENTORY || s === STATES.CRAFT) this.physics.setPaused(true);
    else this.physics.setPaused(false);
    if (s !== STATES.BUILD && this.build) this.build.exit();
    if (s === STATES.BUILD) this.build.enter();
    if (s !== STATES.DRIVE) this.cam.mode = s === STATES.BUILD ? 'build' : 'explore';
    if (s === STATES.DRIVE) this.cam.mode = 'drive';
  }

  startFromTitle() {
    this.audio.resume();
    const save = loadSave();
    if (save) this.toast('Продолжение пути.');
    this.setState(STATES.EXPLORE);
    this.introToasts = 0.2;
  }

  resume() {
    if (this.state === STATES.PAUSE || this.state === STATES.INVENTORY || this.state === STATES.CRAFT || this.state === STATES.TITLE) {
      this.setState(STATES.EXPLORE);
    }
  }

  enterBuild() {
    this.setState(STATES.BUILD);
  }

  toggleInventory() {
    if (this.state === STATES.INVENTORY) this.setState(STATES.EXPLORE);
    else if (this.workshop.contains(this.player.position)) this.setState(STATES.CRAFT);
    else this.setState(STATES.INVENTORY);
  }

  tryCraft(id) {
    tryCraft(this, id);
  }

  placeCrafted(id) {
    const p = this.player.position.clone();
    p.y = this.world.heightAt(p.x, p.z) + 0.1;
    if (id === 'campfire') this._placeCampfire(p);
    if (id === 'crate') this.resources.spawnCrate(p.add(new THREE.Vector3(0.8, 0.4, 0)));
    if (id === 'collector') this.toast('Сборщик поставлен у воды.');
  }

  _placeCampfire(p) {
    const g = new THREE.Group();
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.38, 0.07, 6, 12),
      new THREE.MeshStandardMaterial({ color: 0x6d6a66, roughness: 0.9 }),
    );
    ring.rotation.x = Math.PI / 2;
    const logs = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.12, 0.18),
      new THREE.MeshStandardMaterial({ color: 0x5a3a28 }),
    );
    const glow = new THREE.PointLight(0xff7a32, 0, 7, 1.6);
    glow.position.y = 0.4;
    g.add(ring, logs, glow);
    g.position.copy(p);
    g.userData.kind = 'campfire';
    this.gfx.scene.add(g);
    this.placed.push({ kind: 'campfire', mesh: g, lit: false, light: glow });
  }

  enterVehicle() {
    const seat = this.machine.seat();
    if (!seat || !this.machine.launched) return;
    this.player.hide(true);
    this.player.drop();
    this.setState(STATES.DRIVE);
    this.toast('Держи курс.');
  }

  exitVehicle() {
    const seat = this.machine.seat();
    const p = seat ? seat.mesh.position.clone() : this.player.position.clone();
    p.x += 1.2;
    p.y = this.world.heightAt(p.x, p.z) + 0.2;
    this.player.hide(false);
    this.player.setPosition(p.x, p.y, p.z);
    this.machine.throttle = 0;
    this.audio.setMotor(0);
    this.setState(STATES.EXPLORE);
  }

  // The machine fell off the world (seat below the island mass): stop it and
  // bring the player back to the last safe spot instead of falling forever.
  machineLost() {
    this.machine.stop();
    this.exitVehicle();
    this.ui.flash();
    this.toast('Телега ушла в небо.');
    const p = this.player.lastSafe;
    this.player.setPosition(p.x, p.y + 0.4, p.z);
    this.saveNow();
  }

  lightsources() {
    const lights = [];
    lights.push({ pos: this.workshop.pos.clone().add(new THREE.Vector3(2.6, 1, -1.8)), r: 5 });
    for (const p of this.placed) {
      if (p.kind === 'campfire' && p.lit) lights.push({ pos: p.mesh.position.clone(), r: 5.5 });
    }
    if (this.hasTorch || this.hasLantern) lights.push({ pos: this.player.position.clone(), r: 4.2 });
    return lights;
  }

  toast(t) {
    this.ui?.toast(t);
  }

  onTreeFell() {
    this.progress.trees += 1;
    if (this.progress.trees >= PROGRESS.lumberjack.need && !this.unlocks.lumberjack) {
      this.unlocks.lumberjack = 1;
      grant(this.inventory, 'wood', 4);
      grantPart(this.buildStock, 'PLANK', 4);
      this.toast(PROGRESS.lumberjack.toast);
    }
  }

  notifyProgress() {}

  pickupResource(kind) {
    grant(this.inventory, kind, 1);
    if (kind === 'fruit') {
      this.survival.eatFruit();
      this.progress.fruit += 1;
      if (this.progress.fruit >= PROGRESS.firstHarvest.need && !this.unlocks.firstHarvest) {
        this.unlocks.firstHarvest = 1;
        grantPart(this.buildStock, 'BLOCK', 2);
        this.toast(PROGRESS.firstHarvest.toast);
      }
    }
  }

  respawnFromDeath() {
    this.ui.flash();
    const w = this.workshop.pos;
    this.player.setPosition(w.x + 2, this.world.heightAt(w.x + 2, w.z + 2) + 0.3, w.z + 2);
    this.survival.revive();
    this.player.hide(false);
    if (this.state === STATES.DRIVE) this.setState(STATES.EXPLORE);
    this.toast('Мир подождал.');
    this.saveNow();
  }

  newWorld() {
    clearSave();
    location.reload();
  }

  update(dt) {
    this.input.beginFrame();
    if (this.input.pausePressed || this.input.backPressed) {
      if (this.state === STATES.PAUSE) this.resume();
      else if (this.state !== STATES.TITLE) {
        this.saveNow();
        this.setState(STATES.PAUSE);
      }
    }
    if (this.input.inventoryPressed && this.state !== STATES.TITLE && this.state !== STATES.PAUSE) {
      this.toggleInventory();
    }
    if (this.input.buildPressed && this.state !== STATES.TITLE) {
      if (this.state === STATES.BUILD) this.setState(STATES.EXPLORE);
      else if (this.state === STATES.DRIVE) this.exitVehicle();
      else this.enterBuild();
    }
    if (this.portraitLocked) {
      this.physics.setPaused(true);
      this.simPaused = true;
    }

    const paused = this.simPaused || this.portraitLocked || this.state === STATES.PAUSE || this.state === STATES.TITLE;
    this.daynight.paused = paused;

    if (!paused) {
      this.time += dt;
      this.daynight.update(dt);
      this.wind.update(dt);
      this.weather.update(dt);
      this.physics.step(dt, () => {
        if (this.state === STATES.DRIVE) this.machine.drive(1 / 60, this.input.axis, this.input.action);
      });
      if (this.state !== STATES.DRIVE) {
        this.player.update(dt, this.input, this.cam);
      } else {
        const look = this.input.consumeLook();
        this.cam.addLook(look.x, look.y);
        const seat = this.machine.seat();
        if (seat) {
          this.player.position.copy(seat.mesh.position);
          if (this.input.jumpPressed) this.exitVehicle();
          if (this.machine.flipTimer > 2.5 && (this.input.actionPressed || this.input.keys.KeyF)) this.machine.unflip();
        }
        this.driven += Math.abs(this.machine.throttle) * dt * 4;
        this.progress.driven = this.machine.distance;
        if (this.machine.distance >= PROGRESS.firstRide.need && !this.unlocks.firstRide) {
          this.unlocks.firstRide = 1;
          grantPart(this.buildStock, 'MOTOR', 1);
          grantPart(this.buildStock, 'PROPELLER', 1);
          this.toast(PROGRESS.firstRide.toast);
        }
        const seatP = this.machine.seat()?.mesh.position;
        if (seatP) {
          this.flora.crushNear(seatP, 1.3);
          if (seatP.y < this.machine.lostY) this.machineLost();
        }
      }
      this.interact.update();
      if (this.input.actionPressed) this.interact.primaryDown();
      if (!this.input.action && this.player.charging) this.interact.primaryUp();
      if (this.input.attackPressed) this.interact.attack();
      if (this.state === STATES.BUILD) this.build.update();
      this.flora.update(dt, this.wind.vector, this.player.position);
      this.growth.update(dt, this.flora.plants);
      this.fauna.update(dt);
      this.enemies.update(dt);
      this.workshop.update(dt, this.wind.vector, this.daynight.night);
      this.survival.update(dt);
      this.gfx.water?.update(dt, this.wind.vector, this.daynight.sunDir, this.gfx.camera.position);
      this.gfx.particles?.update(dt, this.wind.vector, this.daynight.night, this.weather.rain);
      this._ambient(dt);
      this._horizon();
      this._nightFire();
      this._eatCarriedFruit();
    } else {
      this.input.consumeLook();
    }

    const focus = this.state === STATES.DRIVE && this.machine.seat()
      ? this.machine.seat().mesh.position
      : this.player.position;
    let hint = null;
    if (this.state === STATES.DRIVE && this.machine.seat()) {
      hint = _hintV.set(0, 0, 1).applyQuaternion(this.machine.seat().mesh.quaternion);
    }
    this.cam.update(dt, focus, hint);
    this.gfx.sky.update(dt, this.daynight, focus, this.gfx.camera.position);
    if (this.gfx.scene.fog) {
      this.gfx.scene.fog.color.copy(this.daynight.fog);
      if ('near' in this.gfx.scene.fog) {
        this.gfx.scene.fog.near = 22 + this.daynight.night * 6;
        this.gfx.scene.fog.far = 148 - this.weather.wet * 18;
      }
    }
    this.physics.sync.apply(this.physics.alpha);
    this.ui.update(dt);
    this.dbg.update(dt);
    this.qualityName = this.gfx.qualityName;

    if (!paused) {
      this.autosaveT += dt;
      if (this.autosaveT > 20) {
        this.autosaveT = 0;
        this.saveNow();
      }
      if (this.introToasts > 0) {
        this.introToasts += dt;
        if (this.introToasts > 5 && this._bootToasts.length) {
          this.toast(this._bootToasts.shift());
          this.introToasts = 0.2;
        }
      }
    }

    for (const c of this.placed) {
      if (c.kind === 'campfire') {
        c.light.intensity = c.lit ? 1.6 + Math.sin(this.time * 7) * 0.25 : 0;
        if (c.lit && this.gfx.particles && Math.random() < dt * 8) {
          _fireP.copy(c.mesh.position).y += 0.3;
          this.gfx.particles.emit('fire', _fireP, 2);
        }
      }
    }

    this.audio.update(dt, {
      wind: this.wind.strength,
      night: this.daynight.night,
      nearWater: Math.hypot(this.player.position.x - this.world.main.pond.x, this.player.position.z - this.world.main.pond.z) < 12,
      fire: this.placed.some((p) => p.lit),
      rain: this.weather.rain,
    });

    this.input.endFrame();
  }

  _ambient(dt) {
    if (Math.random() < dt * 0.35) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * 20;
      _amb.x = Math.cos(a) * r;
      _amb.y = 7;
      _amb.z = Math.sin(a) * r;
      _ambV.x = this.wind.vector.x * 0.2;
      _ambV.y = 0.15;
      _ambV.z = this.wind.vector.z * 0.2;
      this.gfx.particles?.emit('pollen', _amb, 1, _ambV);
    }
  }

  _horizon() {
    const vp = this.world.main.viewpoint;
    const dx = this.player.position.x - vp.x;
    const dz = this.player.position.z - vp.z;
    if (!this.seenHorizon && dx * dx + dz * dz < 64) {
      this.seenHorizon = 1;
      this.unlocks.horizon = 1;
      this.toast(PROGRESS.horizon.toast);
    }
  }

  _nightFire() {
    if (!this.daynight.isDangerNight()) return;
    const near = this.placed.some((p) => p.kind === 'campfire' && p.lit && p.mesh.position.distanceTo(this.player.position) < 4);
    if (near) {
      this.progress.nightFire += 1 / 60;
      if (this.progress.nightFire > 8 && !this.unlocks.firstNight) {
        this.unlocks.firstNight = 1;
        grantPart(this.buildStock, 'GLIDER_WING', 1);
        this.toast(PROGRESS.firstNight.toast);
      }
    }
  }

  _eatCarriedFruit() {
    if (this.player.carry && this.player.carry.kind === 'fruit' && this.input.attackPressed) {
      this.resources.collectProp(this.player.carry);
      this.player.carry = null;
      this.pickupResource('fruit');
      this.toast('Плод отдаёт тепло.');
    }
  }

  _physDebug() {
    if (!this._physLines) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(9), 3));
      this._physLines = new THREE.LineSegments(
        geo,
        new THREE.LineBasicMaterial({ color: 0x88ffaa, depthTest: false }),
      );
      this._physLines.frustumCulled = false;
      this.gfx.scene.add(this._physLines);
    }
    const pts = [];
    this.physics.sync.entities.forEach((e) => {
      if (!e.body) return;
      const t = e.body.translation();
      pts.push(t.x, t.y, t.z, t.x, t.y + 0.6, t.z);
    });
    const arr = new Float32Array(pts);
    this._physLines.geometry.setAttribute('position', new THREE.BufferAttribute(arr, 3));
  }

  applyShot(name) {
    this.audio.resume();
    this.setState(STATES.SHOT);
    this.physics.setPaused(false);
    this.simPaused = false;
    if (name === 'shot-title') this.setState(STATES.TITLE);
    if (name === 'shot-world') {
      this.setState(STATES.EXPLORE);
      this.daynight.setTime(0.32);
      this.gfx.setQuality('HIGH');
      this.gfx.renderer.toneMappingExposure = 1.32;
      const look = new THREE.Vector3(4.5, 5.6, -6.2);
      this.cam.locked = {
        position: new THREE.Vector3(17.4, 11.6, 15.2),
        look,
      };
      this.player.setPosition(4.6, this.world.heightAt(4.6, -3.8) + 0.15, -3.8);
    }
    if (name === 'shot-build') {
      this.setState(STATES.BUILD);
      const o = this.workshop.pos.clone();
      o.z += 4;
      o.y = this.world.heightAt(o.x, o.z);
      this.machine.spawnCart(o);
    }
    if (name === 'shot-vehicle') {
      const o = this.workshop.pos.clone();
      o.z += 5;
      o.y = this.world.heightAt(o.x, o.z);
      this.machine.spawnCart(o);
      this.machine.launch();
      this.enterVehicle();
    }
    if (name === 'shot-night') {
      this.setState(STATES.EXPLORE);
      this.daynight.setTime(0.9);
      this._placeCampfire(this.player.position.clone());
      this.placed[this.placed.length - 1].lit = true;
    }
    if (name === 'shot-survival') {
      this.setState(STATES.EXPLORE);
      this.survival.hunger = 35;
      this.survival.thirst = 40;
    }
    if (name === 'shot-pause') this.setState(STATES.PAUSE);
  }

  render() {
    this.gfx.render();
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.physics.dispose();
    this.gfx.dispose();
    this.audio.dispose();
  }
}
