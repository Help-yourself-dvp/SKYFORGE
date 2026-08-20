export const CART_BLUEPRINT = {
  id: 'cart',
  name: 'Чертёж: тележка',
  // Geometry is laid out so every joint's two anchor ports coincide exactly
  // in world space AND every part keeps the identity rotation. A fixed joint
  // between differently-yawed parts makes the solver enforce equal
  // orientations, which kicks a freshly launched machine apart.
  parts: [
    { key: 'beamL', type: 'STRUT', x: 0, y: 0.3, z: -0.75, yaw: 0 },
    { key: 'beamR', type: 'STRUT', x: 0, y: 0.3, z: 0.75, yaw: 0 },
    { key: 'seat', type: 'SEAT', x: 0, y: 0.52, z: 0, yaw: 0 },
    { key: 'motor', type: 'MOTOR', x: 0, y: 0.32, z: -0.4, yaw: 0 },
    { key: 'steer', type: 'STEER', x: 0, y: 0.62, z: 0.4, yaw: 0 },
    { key: 'wRL', type: 'WHEEL', x: -0.8, y: 0.275, z: -0.75, yaw: 0 },
    { key: 'wRR', type: 'WHEEL', x: 0.8, y: 0.275, z: -0.75, yaw: 0 },
    { key: 'wFL', type: 'WHEEL', x: -0.8, y: 0.275, z: 0.75, yaw: 0 },
    { key: 'wFR', type: 'WHEEL', x: 0.8, y: 0.275, z: 0.75, yaw: 0 },
  ],
  joints: [
    { a: 'seat', pa: 'ny', b: 'beamL', pb: 'py' },
    { a: 'seat', pa: 'ny2', b: 'beamR', pb: 'py' },
    { a: 'motor', pa: 'py', b: 'seat', pb: 'nz' },
    { a: 'steer', pa: 'ny', b: 'seat', pb: 'pz' },
    { a: 'wRL', pa: 'hub', b: 'beamL', pb: 'nx' },
    { a: 'wRR', pa: 'hub', b: 'beamL', pb: 'px' },
    { a: 'wFL', pa: 'hub', b: 'beamR', pb: 'nx' },
    { a: 'wFR', pa: 'hub', b: 'beamR', pb: 'px' },
  ],
};

export const BLUEPRINTS = [CART_BLUEPRINT];
