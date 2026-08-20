// Numeric check: does stick-right move the player toward screen-right?
import * as THREE from 'three';
globalThis.__APP_VERSION__ = '0.1.0';
const { createRng, createNoise2D } = await import('../../src/rng.js');
const { QUALITY } = await import('../../src/config.js');
const { initRapier, PhysicsWorld } = await import('../../src/physics/world.js');
const { Archipelago } = await import('../../src/world/archipelago.js');
const { Workshop } = await import('../../src/world/workshop.js');
const { Flora } = await import('../../src/world/flora.js');
const { Resources } = await import('../../src/world/resources.js');
const { Fauna } = await import('../../src/world/fauna.js');
const { Enemies } = await import('../../src/world/enemies.js');
const { DayNight } = await import('../../src/world/daynight.js');
const { Weather } = await import('../../src/world/weather.js');
const { Wind } = await import('../../src/sim/wind.js');
const { Growth } = await import('../../src/sim/growth.js');
const { Player } = await import('../../src/player/player.js');
const { GameCamera } = await import('../../src/player/camera.js');
const { Interact } = await import('../../src/player/interact.js');
const { Survival } = await import('../../src/player/survival.js');
const { MachineSystem } = await import('../../src/build/machine.js');
const { BuildController } = await import('../../src/build/ghost_ctrl.js');
const { Sky } = await import('../../src/gfx/sky.js');
const { Water } = await import('../../src/gfx/water.js');
const { Particles } = await import('../../src/gfx/particles.js');
const { emptyInventory } = await import('../../src/craft/resources.js');
const { emptyBuildStock } = await import('../../src/build/inventory.js');
await initRapier();
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(52, 1, 0.18, 320);
const gfx = { scene, camera, quality: QUALITY.MEDIUM, qualityName: 'MEDIUM',
  renderer: { info: { render: { calls: 0, triangles: 0 } }, setSize(){}, setPixelRatio(){}, render(){}, dispose(){} },
  resize(){}, setQuality(){}, render(){}, dispose(){},
  initWorld(pond){ this.water = new Water(scene, pond); this.particles = new Particles(scene, this.quality.particles); this.sky = new Sky(scene); } };
const game = { gfx, state: 'explore', simPaused: false, disposed: false, time: 0, placed: [], progress: {fruit:0,trees:0,driven:0,nightFire:0},
  tools: [], inventory: emptyInventory(), buildStock: emptyBuildStock(), unlocks: {}, hasTorch: false, hasLantern: false, seenHorizon: 0, autosaveT: 0,
  audio: { play(){}, setMotor(){}, update(){}, resume(){}, dispose(){}, activeNodes(){return 0} }, ui: { toast(){}, flash(){}, update(){} },
  toast(){}, saveNow(){}, newWorld(){}, lightsources(){ return []; }, notifyProgress(){}, onTreeFell(){}, pickupResource(){}, respawnFromDeath(){},
  enterVehicle(){}, exitVehicle(){}, machineLost(){} };
game.rng = createRng('SKY-001');
game.noise = createNoise2D(game.rng);
game.wind = new Wind(game.rng);
game.weather = new Weather(game.rng);
game.growth = new Growth();
game.world = new Archipelago(game.rng, game.noise).build(scene);
game.physics = new PhysicsWorld();
game.physics.pond = game.world.main.pond;
game.physics.waterLevel = game.world.main.pond.level;
game.world.main.addCollider(game.physics);
const pond = game.world.main.pond;
const wb = game.physics.world.createRigidBody(game.physics.R.RigidBodyDesc.fixed().setTranslation(pond.x, pond.level - 0.8, pond.z));
game.physics.world.createCollider(game.physics.R.ColliderDesc.cylinder(1.2, pond.radius).setSensor(true), wb);
gfx.initWorld(pond);
game.physics.warm();
game.daynight = new DayNight();
game.workshop = new Workshop(game, new THREE.Vector3(game.world.main.workshop.x, game.world.heightAt(game.world.main.workshop.x, game.world.main.workshop.z), game.world.main.workshop.z));
game.flora = new Flora(game); game.flora.generate(game.world.main, game.rng);
game.resources = new Resources(game); game.resources.generate(game.world.main, game.rng);
game.fauna = new Fauna(game); game.fauna.generate(game.world.main, game.rng);
game.enemies = new Enemies(game);
game.player = new Player(game);
game.interact = new Interact(game);
game.survival = new Survival(game);
game.machine = new MachineSystem(game);
game.build = new BuildController(game);
game.workshop.spawnCrates();
const spawn = new THREE.Vector3(game.world.main.workshop.x + 2.2, game.world.heightAt(game.world.main.workshop.x + 2.2, game.world.main.workshop.z + 3.4) + 0.2, game.world.main.workshop.z + 3.4);
game.player.setPosition(0, game.world.heightAt(0, 0) + 0.3, 0);
game.player.lastSafe.set(0, game.world.heightAt(0, 0) + 0.3, 0);
game.cam = new GameCamera(camera, game);
game.daynight.setTime(0.32);
game.input = { keys: Object.create(null) };

const input = { axis: {x:1, y:0}, action:false, actionPressed:false, attackPressed:false, jumpPressed:false, buildPressed:false, inventoryPressed:false, pausePressed:false, backPressed:false, rotateL:false, rotateR:false, keys: Object.create(null), beginFrame(){}, endFrame(){}, consumeLook(){ return {x:0,y:0}; } };
// default camera (update once so it's actually placed behind the player)
game.cam.yaw = 0.55; game.cam.pitch = 0.22;
game.cam.update(1/60, game.player.position, null);
const p0 = game.player.position.clone();
for (let i = 0; i < 60; i++) { game.player.update(1/60, input, game.cam); }
const d = game.player.position.clone().sub(p0); d.y = 0;
const camRight = new THREE.Vector3().crossVectors(camera.getWorldDirection(new THREE.Vector3()).setY(0), new THREE.Vector3(0,1,0)).normalize();
const fwd = camera.getWorldDirection(new THREE.Vector3()); fwd.y = 0; fwd.normalize();
console.log('stick right => displacement', d.x.toFixed(2), d.z.toFixed(2));
console.log('camera right           ', camRight.x.toFixed(2), camRight.z.toFixed(2));
console.log('camera forward         ', fwd.x.toFixed(2), fwd.z.toFixed(2));
console.log('dot(disp, camRight) =', d.dot(camRight).toFixed(2), d.dot(camRight) > 0 ? 'OK (stick right = screen right)' : 'INVERTED');
