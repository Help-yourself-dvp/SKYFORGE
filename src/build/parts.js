import * as THREE from 'three';

const _v = new THREE.Vector3();

function port(id, x, y, z, type = 'fixed', ax = 0, ay = 1, az = 0) {
  return { id, x, y, z, type, ax, ay, az };
}

export const PART_DEFS = {
  BLOCK: {
    id: 'BLOCK',
    name: 'Брус',
    mass: 4,
    size: [0.7, 0.7, 0.7],
    color: 0x8a6238,
    metal: 0.05,
    rough: 0.72,
    ports: [
      port('px', 0.35, 0, 0),
      port('nx', -0.35, 0, 0),
      port('py', 0, 0.35, 0),
      port('ny', 0, -0.35, 0),
      port('pz', 0, 0, 0.35),
      port('nz', 0, 0, -0.35),
    ],
  },
  PLANK: {
    id: 'PLANK',
    name: 'Доска',
    mass: 2.2,
    size: [1.2, 0.15, 0.6],
    color: 0xa07442,
    metal: 0.02,
    rough: 0.78,
    ports: [
      port('px', 0.6, 0, 0),
      port('nx', -0.6, 0, 0),
      port('pz', 0, 0, 0.3),
      port('nz', 0, 0, -0.3),
      port('py', 0, 0.08, 0),
    ],
  },
  STRUT: {
    id: 'STRUT',
    name: 'Тяга',
    mass: 2.6,
    size: [1.6, 0.16, 0.16],
    color: 0x6e5340,
    metal: 0.15,
    rough: 0.6,
    ports: [
      port('px', 0.8, 0, 0),
      port('nx', -0.8, 0, 0),
      port('py', 0, 0.08, 0),
    ],
  },
  WHEEL: {
    id: 'WHEEL',
    name: 'Колесо',
    mass: 3.2,
    size: [0.22, 0.55, 0.55],
    shape: 'cylinder',
    axis: 'x',
    color: 0x2a2a2c,
    metal: 0.1,
    rough: 0.55,
    material: 'wheel',
    ports: [port('hub', 0, 0, 0, 'hinge', 1, 0, 0)],
  },
  MOTOR: {
    id: 'MOTOR',
    name: 'Мотор',
    mass: 6,
    size: [0.55, 0.4, 0.55],
    color: 0x4a3a32,
    metal: 0.55,
    rough: 0.4,
    emissive: 0x3a2010,
    ports: [
      port('py', 0, 0.2, 0),
      port('ny', 0, -0.2, 0),
      port('px', 0.28, 0, 0, 'hinge', 1, 0, 0),
      port('nx', -0.28, 0, 0, 'hinge', 1, 0, 0),
      port('pz', 0, 0, 0.28),
    ],
  },
  SEAT: {
    id: 'SEAT',
    name: 'Сиденье',
    mass: 2.4,
    size: [0.55, 0.28, 0.6],
    color: 0x6b2430,
    metal: 0.05,
    rough: 0.7,
    seat: true,
    ports: [
      port('ny', 0, -0.14, 0),
      port('pz', 0, 0, 0.3),
      port('nz', 0, 0, -0.3),
    ],
  },
  STEER: {
    id: 'STEER',
    name: 'Руль',
    mass: 1.8,
    size: [0.45, 0.18, 0.45],
    color: 0xc4a15a,
    metal: 0.45,
    rough: 0.35,
    steer: true,
    ports: [
      port('ny', 0, -0.1, 0, 'hinge', 0, 1, 0),
      port('py', 0, 0.1, 0),
    ],
  },
  SPRING: {
    id: 'SPRING',
    name: 'Пружина',
    mass: 1.6,
    size: [0.18, 0.55, 0.18],
    color: 0x8a8f78,
    metal: 0.7,
    rough: 0.3,
    ports: [
      port('py', 0, 0.28, 0, 'spring', 0, 1, 0),
      port('ny', 0, -0.28, 0, 'spring', 0, 1, 0),
    ],
  },
  BALLOON: {
    id: 'BALLOON',
    name: 'Баллон',
    mass: 1.1,
    size: [0.9, 0.9, 0.9],
    shape: 'sphere',
    color: 0x8a4034,
    metal: 0.05,
    rough: 0.55,
    lift: 18,
    buoyancy: true,
    ports: [port('ny', 0, -0.45, 0)],
  },
  PROPELLER: {
    id: 'PROPELLER',
    name: 'Пропеллер',
    mass: 2.1,
    size: [1.2, 0.08, 0.18],
    color: 0x5a4a3a,
    metal: 0.2,
    rough: 0.5,
    thrust: 22,
    ports: [port('hub', 0, 0, 0, 'hinge', 0, 0, 1)],
  },
  GLIDER_WING: {
    id: 'GLIDER_WING',
    name: 'Крыло',
    mass: 2.8,
    size: [2.2, 0.08, 0.7],
    color: 0xc4b08a,
    metal: 0.02,
    rough: 0.65,
    wing: true,
    ports: [
      port('nx', -0.2, 0, 0),
      port('px', 0.2, 0, 0),
    ],
  },
};

export const PART_ORDER = [
  'BLOCK', 'PLANK', 'STRUT', 'WHEEL', 'MOTOR', 'SEAT', 'STEER', 'SPRING', 'BALLOON', 'PROPELLER', 'GLIDER_WING',
];

export function partDef(type) {
  return PART_DEFS[type] || PART_DEFS.BLOCK;
}

export function createPartMesh(type) {
  const def = partDef(type);
  const group = new THREE.Group();
  group.userData.kind = 'part';
  group.userData.partType = type;
  const mat = new THREE.MeshStandardMaterial({
    color: def.color,
    roughness: def.rough,
    metalness: def.metal,
    emissive: def.emissive ? new THREE.Color(def.emissive) : 0x000000,
    emissiveIntensity: def.emissive ? 0.25 : 0,
  });
  let geo;
  if (def.shape === 'sphere') {
    geo = new THREE.SphereGeometry(def.size[0] * 0.5, 14, 10);
  } else if (def.shape === 'cylinder') {
    geo = new THREE.CylinderGeometry(def.size[1] * 0.5, def.size[2] * 0.5, def.size[0], 14);
    geo.rotateZ(Math.PI / 2);
  } else {
    geo = new THREE.BoxGeometry(def.size[0], def.size[1], def.size[2]);
  }
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData.kind = 'part';
  group.add(mesh);

  if (type === 'SEAT') {
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.42, 0.1), mat);
    back.position.set(0, 0.28, -0.26);
    back.castShadow = true;
    group.add(back);
  }
  if (type === 'STEER') {
    const bar = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.03, 8, 16), mat);
    bar.rotation.x = Math.PI / 2;
    bar.position.y = 0.12;
    group.add(bar);
  }
  if (type === 'MOTOR') {
    const cap = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16, 0.16, 0.22, 10),
      new THREE.MeshStandardMaterial({ color: 0xc4a15a, metalness: 0.7, roughness: 0.3 }),
    );
    cap.rotation.z = Math.PI / 2;
    group.add(cap);
  }
  if (type === 'WHEEL') {
    const hub = new THREE.Mesh(
      new THREE.CylinderGeometry(0.1, 0.1, 0.26, 8),
      new THREE.MeshStandardMaterial({ color: 0xc4a15a, metalness: 0.6, roughness: 0.35 }),
    );
    hub.rotation.z = Math.PI / 2;
    group.add(hub);
  }
  if (type === 'PROPELLER') {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.06, 0.16), mat);
    group.add(blade);
    const blade2 = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.06, 1.2), mat);
    group.add(blade2);
  }
  if (type === 'SPRING') {
    const coil = new THREE.Mesh(
      new THREE.CylinderGeometry(0.1, 0.1, 0.5, 8, 1, true),
      new THREE.MeshStandardMaterial({ color: 0xa8aa9a, metalness: 0.75, roughness: 0.28, side: THREE.DoubleSide }),
    );
    group.add(coil);
  }
  group.userData.def = def;
  return group;
}

export function worldPort(part, portId) {
  const def = partDef(part.type);
  const p = def.ports.find((x) => x.id === portId);
  if (!p) return null;
  _v.set(p.x, p.y, p.z).applyQuaternion(part.mesh.quaternion).add(part.mesh.position);
  return { pos: _v.clone(), type: p.type, ax: p.ax, ay: p.ay, az: p.az, def: p };
}

export function localPort(type, portId) {
  const def = partDef(type);
  return def.ports.find((x) => x.id === portId) || null;
}
