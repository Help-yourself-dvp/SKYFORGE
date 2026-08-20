import * as THREE from 'three';
import { Ghost } from './ghost.js';
import { takePart } from './inventory.js';

const _gDir = new THREE.Vector3();
const _gPos = new THREE.Vector3();

export class BuildController {
  constructor(game) {
    this.game = game;
    this.ghost = new Ghost(game.gfx.scene);
    this.type = 'BLOCK';
    this.validPlace = false;
    this.clearHold = 0;
  }

  enter() {
    this.ghost.setType(this.type);
    this.ghost.show(true);
    this.game.cam.mode = 'build';
  }

  exit() {
    this.ghost.show(false);
    this.game.cam.mode = 'explore';
  }

  setType(t) {
    this.type = t;
    this.ghost.setType(t);
  }

  command(cmd) {
    const g = this.game;
    if (cmd === 'rotL') this.ghost.rotate('up');
    if (cmd === 'rotR') this.ghost.rotate('right');
    if (cmd === 'cart') {
      const origin = g.player.position.clone();
      origin.y = g.world.heightAt(origin.x, origin.z) + 0.2;
      origin.z += 2.2;
      g.machine.spawnCart(origin);
      g.audio.play('snap');
      g.toast('Телега собрана из тех же частей.');
    }
    if (cmd === 'launch') g.machine.launch();
    if (cmd === 'stop') g.machine.stop();
    if (cmd === 'clear') {
      this.clearHold += 1;
      if (this.clearHold >= 2) {
        g.machine.clear();
        this.clearHold = 0;
        g.toast('Сборка разобрана.');
      } else g.toast('Ещё раз — сбросить сборку.');
    }
  }

  update() {
    const g = this.game;
    const origin = g.cam.camera.position;
    const dir = g.cam.camera.getWorldDirection(_gDir);
    const hit = g.physics.raycast(
      { x: origin.x, y: origin.y, z: origin.z },
      { x: dir.x, y: dir.y, z: dir.z },
      14,
      g.player.body,
    );
    let pos = null;
    if (hit) pos = _gPos.set(hit.point.x, hit.point.y + 0.12, hit.point.z);
    else {
      dir.setY(0);
      if (dir.lengthSq() < 1e-6) dir.set(0, 0, -1);
      pos = _gPos.copy(g.player.position).addScaledVector(dir.normalize(), 2.2);
      pos.y = g.world.heightAt(pos.x, pos.z) + 0.4;
    }
    this.ghost.update(pos, g.machine.parts);
    this.validPlace = this.ghost.valid;
    if (g.input.rotateL) this.ghost.rotate('up');
    if (g.input.rotateR) this.ghost.rotate('right');
  }

  place() {
    const g = this.game;
    if (!this.ghost.valid || !this.ghost.mesh) return;
    if (!takePart(g.buildStock, this.type)) {
      if (!g.workshop.contains(g.player.position)) {
        g.toast('Вдали от мастерской части на счету.');
        return;
      }
      if ((g.buildStock[this.type] || 0) <= 0) {
        g.toast('Нет такой детали.');
        return;
      }
    }
    const p = this.ghost.mesh.position.clone();
    const q = this.ghost.mesh.quaternion.clone();
    g.machine.place(this.type, p, q, this.ghost.snap);
    g.audio.play('snap');
    g.gfx.particles?.emit('spark', p, 6);
  }
}
