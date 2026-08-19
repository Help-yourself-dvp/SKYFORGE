import * as THREE from 'three';

export function makeInstanced(geometry, material, count) {
  const mesh = new THREE.InstancedMesh(geometry, material, count);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.count = 0;
  mesh.userData.kind = 'instanced';
  return mesh;
}

export function setInstance(mesh, i, pos, quat, scale) {
  const m = new THREE.Matrix4();
  m.compose(pos, quat || new THREE.Quaternion(), scale || new THREE.Vector3(1, 1, 1));
  mesh.setMatrixAt(i, m);
}

export function commitInstances(mesh, count) {
  mesh.count = count;
  mesh.instanceMatrix.needsUpdate = true;
}
