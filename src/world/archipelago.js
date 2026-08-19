import * as THREE from 'three';
import { Island } from './island.js';

export class Archipelago {
  constructor(rng, noise) {
    this.rng = rng;
    this.noise = noise;
    this.main = new Island(rng, noise);
    this.far = [
      { x: 92, y: 8, z: -40, r: 14, h: 7 },
      { x: -78, y: -6, z: 55, r: 11, h: 6 },
      { x: 40, y: 18, z: 88, r: 9, h: 5 },
      { x: -110, y: 4, z: -20, r: 16, h: 9 },
    ];
  }

  build(scene) {
    this.group = new THREE.Group();
    this.group.userData.kind = 'archipelago';
    const top = this.main.buildMesh();
    const under = this.main.buildUnderside();
    this.group.add(top);
    this.group.add(under);
    this.terrain = top;
    this._distant();
    scene.add(this.group);
    return this;
  }

  _distant() {
    const rock = new THREE.MeshStandardMaterial({ color: 0x5a564e, roughness: 0.9 });
    const grass = new THREE.MeshStandardMaterial({ color: 0x3a5240, roughness: 0.88 });
    for (const d of this.far) {
      const g = new THREE.Group();
      g.position.set(d.x, d.y, d.z);
      g.userData.kind = 'farIsland';
      const top = new THREE.Mesh(new THREE.CylinderGeometry(d.r, d.r * 0.82, 2.2, 10), grass);
      top.position.y = d.h;
      const mass = new THREE.Mesh(new THREE.ConeGeometry(d.r * 0.95, d.h * 1.6, 8), rock);
      mass.rotation.x = Math.PI;
      mass.position.y = d.h - 1.4;
      top.castShadow = true;
      mass.castShadow = true;
      g.add(top);
      g.add(mass);
      for (let i = 0; i < 3; i++) {
        const spike = new THREE.Mesh(new THREE.ConeGeometry(d.r * 0.18, d.h * 0.8, 5), rock);
        const a = (i / 3) * Math.PI * 2;
        spike.position.set(Math.cos(a) * d.r * 0.4, d.h - 2.4, Math.sin(a) * d.r * 0.4);
        spike.rotation.x = Math.PI;
        g.add(spike);
      }
      this.group.add(g);
    }
  }

  heightAt(x, z) {
    return this.main.sample(x, z);
  }

  dispose() {
    this.group?.parent?.remove(this.group);
  }
}
