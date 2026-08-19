import * as THREE from 'three';
import { createPartMesh, partDef } from './parts.js';
import { applySnap, findSnap, overlapTooMuch, rotateLocal } from './snap.js';

export class Ghost {
  constructor(scene) {
    this.scene = scene;
    this.type = 'BLOCK';
    this.mesh = null;
    this.valid = false;
    this.snap = null;
    this.yaw = 0;
    this.visible = false;
    this.matOk = new THREE.MeshStandardMaterial({
      color: 0xc4a15a,
      emissive: 0x6a4a18,
      emissiveIntensity: 0.45,
      transparent: true,
      opacity: 0.62,
      roughness: 0.4,
      metalness: 0.3,
      depthWrite: false,
    });
    this.matBad = new THREE.MeshStandardMaterial({
      color: 0x6b2430,
      emissive: 0x3a1014,
      emissiveIntensity: 0.3,
      transparent: true,
      opacity: 0.5,
      roughness: 0.6,
      depthWrite: false,
    });
  }

  setType(type) {
    this.type = type;
    this.rebuild();
  }

  rebuild() {
    if (this.mesh) this.scene.remove(this.mesh);
    this.mesh = createPartMesh(this.type);
    this.mesh.traverse((o) => {
      if (o.isMesh) {
        o.material = this.matOk;
        o.castShadow = false;
      }
    });
    this.mesh.visible = this.visible;
    this.scene.add(this.mesh);
  }

  show(v) {
    this.visible = v;
    if (this.mesh) this.mesh.visible = v;
    if (v && !this.mesh) this.rebuild();
  }

  rotate(axis) {
    if (!this.mesh) return;
    rotateLocal(this.mesh, axis, 1);
  }

  update(hitPos, parts) {
    if (!this.mesh || !this.visible) return;
    if (hitPos) this.mesh.position.copy(hitPos);
    this.snap = findSnap(this.mesh, this.type, parts);
    if (this.snap) applySnap(this.mesh, this.type, this.snap);
    const box = new THREE.Box3().setFromObject(this.mesh);
    const overlap = overlapTooMuch(box, parts);
    this.valid = !overlap && (!this.snap || this.snap.dist < 0.29);
    if (!this.snap && hitPos) this.valid = !overlap;
    const mat = this.valid ? this.matOk : this.matBad;
    this.mesh.traverse((o) => {
      if (o.isMesh) o.material = mat;
    });
  }

  dispose() {
    if (this.mesh) this.scene.remove(this.mesh);
    this.matOk.dispose();
    this.matBad.dispose();
  }
}
