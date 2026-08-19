export const CART_BLUEPRINT = {
  id: 'cart',
  name: 'Чертёж: тележка',
  parts: [
    { key: 'beamL', type: 'STRUT', x: -0.55, y: 0.45, z: 0, yaw: Math.PI / 2 },
    { key: 'beamR', type: 'STRUT', x: 0.55, y: 0.45, z: 0, yaw: Math.PI / 2 },
    { key: 'seat', type: 'SEAT', x: 0, y: 0.72, z: 0.05, yaw: 0 },
    { key: 'motor', type: 'MOTOR', x: 0, y: 0.62, z: -0.7, yaw: 0 },
    { key: 'steer', type: 'STEER', x: 0, y: 0.78, z: 0.7, yaw: 0 },
    { key: 'wFL', type: 'WHEEL', x: -0.78, y: 0.32, z: 0.62, yaw: 0 },
    { key: 'wFR', type: 'WHEEL', x: 0.78, y: 0.32, z: 0.62, yaw: 0 },
    { key: 'wRL', type: 'WHEEL', x: -0.78, y: 0.32, z: -0.62, yaw: 0 },
    { key: 'wRR', type: 'WHEEL', x: 0.78, y: 0.32, z: -0.62, yaw: 0 },
  ],
  joints: [
    { a: 'seat', pa: 'ny', b: 'beamL', pb: 'py' },
    { a: 'seat', pa: 'ny', b: 'beamR', pb: 'py' },
    { a: 'motor', pa: 'py', b: 'beamL', pb: 'nx' },
    { a: 'motor', pa: 'py', b: 'beamR', pb: 'px' },
    { a: 'steer', pa: 'ny', b: 'beamL', pb: 'px' },
    { a: 'wFL', pa: 'hub', b: 'beamL', pb: 'px' },
    { a: 'wFR', pa: 'hub', b: 'beamR', pb: 'nx' },
    { a: 'wRL', pa: 'hub', b: 'beamL', pb: 'nx' },
    { a: 'wRR', pa: 'hub', b: 'beamR', pb: 'px' },
  ],
};

export const BLUEPRINTS = [CART_BLUEPRINT];
