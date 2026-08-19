import * as THREE from 'three';
import { SNAP_RADIUS } from '../config.js';
import { partDef } from './parts.js';

const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _q = new THREE.Quaternion();

export function worldPortPos(mesh, port) {
  _a.set(port.x, port.y, port.z).applyQuaternion(mesh.quaternion).add(mesh.position);
  return _a.clone();
}

export function findSnap(ghostMesh, ghostType, parts, ignoreId = null) {
  const gDef = partDef(ghostType);
  let best = null;
  let bestDist = SNAP_RADIUS;
  for (const gp of gDef.ports) {
    const gPos = worldPortPos(ghostMesh, gp);
    for (const part of parts) {
      if (part.id === ignoreId) continue;
      const def = partDef(part.type);
      for (const pp of def.ports) {
        if (part.usedPorts && part.usedPorts.has(pp.id)) continue;
        const pPos = worldPortPos(part.mesh, pp);
        const d = gPos.distanceTo(pPos);
        if (d < bestDist) {
          bestDist = d;
          best = { ghostPort: gp, target: part, targetPort: pp, dist: d, gPos, pPos };
        }
      }
    }
  }
  return best;
}

export function applySnap(ghostMesh, ghostType, snap) {
  if (!snap) return;
  const gp = snap.ghostPort;
  _a.set(gp.x, gp.y, gp.z).applyQuaternion(ghostMesh.quaternion);
  ghostMesh.position.copy(snap.pPos).sub(_a);
}

export function portsCompatible(a, b) {
  if (!a || !b) return false;
  if (a.type === 'fixed' || b.type === 'fixed') return true;
  return a.type === b.type;
}

export function overlapTooMuch(ghostBox, parts, slop = 0.04) {
  const g = ghostBox.clone().expandByScalar(-slop);
  const box = new THREE.Box3();
  for (const p of parts) {
    box.setFromObject(p.mesh);
    if (g.intersectsBox(box)) {
      const i = g.clone().intersect(box);
      const vol = Math.max(0, i.max.x - i.min.x) * Math.max(0, i.max.y - i.min.y) * Math.max(0, i.max.z - i.min.z);
      if (vol > 0.012) return true;
    }
  }
  return false;
}

export function rotateLocal(mesh, axis, steps = 1) {
  const e = new THREE.Euler().setFromQuaternion(mesh.quaternion, 'YXZ');
  if (axis === 'up') e.y += (Math.PI / 2) * steps;
  else e.x += (Math.PI / 2) * steps;
  _q.setFromEuler(e);
  mesh.quaternion.copy(_q);
}
