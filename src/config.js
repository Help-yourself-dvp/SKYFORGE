export const VERSION = __APP_VERSION__;
export const DEFAULT_SEED = 'SKY-001';
export const SAVE_KEY = 'skyforge.save.v1';

export const GRAVITY = { x: 0, y: -9.81, z: 0 };
export const FIXED_DT = 1 / 60;
export const MAX_SUBSTEPS = 3;

export const ISLAND_RADIUS = 48;
export const ISLAND_HEIGHT = 11;
export const HEIGHTMAP_RES = 96;

export const PLAYER = {
  radius: 0.38,
  height: 1.72,
  walkSpeed: 4.6,
  runSpeed: 7.1,
  airControl: 0.42,
  jumpSpeed: 6.9,
  coyoteTime: 0.08,
  jumpBuffer: 0.1,
  stepHeight: 0.42,
  maxSlope: 48 * Math.PI / 180,
  carryMass: 28,
  throwChargeTime: 0.85,
  throwForceMin: 5,
  throwForceMax: 16,
  fallRespawnDelay: 1.2,
  eyeHeight: 1.48,
};

export const CAMERA = {
  fov: 52,
  near: 0.12,
  far: 420,
  distance: 5.8,
  height: 2.15,
  shoulder: 0.55,
  pitchMin: -0.72,
  pitchMax: 0.92,
  spring: 10,
  collideRadius: 0.22,
  driveDistance: 8.2,
  driveHeight: 1.35,
  buildDistance: 9.4,
  buildHeight: 3.6,
};

export const HIT = {
  cooldown: 0.35,
  woodDamage: 22,
  woodDamageAxe: 46,
  stoneDamage: 18,
  stoneDamageHammer: 34,
  reach: 2.6,
};

export const TREE_HEALTH = 100;
export const ROCK_HEALTH = 90;
export const ORE_HEALTH = 110;

export const DAY_LENGTH = 8 * 60;
export const AUTOSAVE_INTERVAL = 20;

export const WIND = {
  base: 1.6,
  gustIntervalMin: 20,
  gustIntervalMax: 40,
  gustStrength: 4.8,
};

export const SNAP_RADIUS = 0.28;
export const BUILD_OVERLAP_SLOP = 0.04;

export const VEHICLE = {
  steerAngle: 35 * Math.PI / 180,
  motorTorque: 48,
  maxWheelSpeed: 28,
  handbrake: 18,
  flipTime: 2.5,
  jointBreakImpulse: 920,
};

export const SURVIVAL = {
  maxHealth: 100,
  maxHunger: 100,
  maxThirst: 100,
  hungerPerSec: 0.07,
  thirstPerSec: 0.09,
  healthRegen: 1.4,
  healthDrainCritical: 1.8,
  fruitHunger: 18,
  fruitThirst: 10,
  waterThirst: 34,
  shadeDamage: 12,
  shadeCooldown: 1.4,
};

export const QUALITY = {
  HIGH: {
    shadow: 2048,
    bloom: true,
    grass: 1,
    particles: 1,
    ssao: false,
  },
  MEDIUM: {
    shadow: 1024,
    bloom: true,
    grass: 0.55,
    particles: 0.65,
    ssao: false,
  },
  LOW: {
    shadow: 768,
    bloom: false,
    grass: 0.28,
    particles: 0.35,
    ssao: false,
  },
};

export const GROUPS = {
  staticWorld: 0x0001,
  dynamicProps: 0x0002,
  player: 0x0004,
  buildGhost: 0x0008,
  machine: 0x0010,
  interactionSensor: 0x0020,
  water: 0x0040,
  fauna: 0x0080,
  enemy: 0x0100,
};

export const ALL_GROUPS =
  GROUPS.staticWorld |
  GROUPS.dynamicProps |
  GROUPS.player |
  GROUPS.buildGhost |
  GROUPS.machine |
  GROUPS.interactionSensor |
  GROUPS.water |
  GROUPS.fauna |
  GROUPS.enemy;

export function interactionGroups(membership, filter) {
  return (membership << 16) | (filter & 0xffff);
}

export const MATERIALS = {
  stone: { friction: 0.9, restitution: 0.05 },
  wood: { friction: 0.6, restitution: 0.1 },
  metal: { friction: 0.4, restitution: 0.08 },
  wheel: { friction: 1.2, restitution: 0.02 },
  ground: { friction: 0.8, restitution: 0.04 },
  flesh: { friction: 0.55, restitution: 0.05 },
};

export const COLORS = {
  slateTeal: 0x2b4a55,
  oxblood: 0x6b2430,
  brass: 0xc4a15a,
  copper: 0x6e8b74,
  ochre: 0xb3874a,
  pine: 0x2f4a38,
  indigo: 0x1a2340,
  sunset: 0xe09a4a,
  soil: 0x5a4634,
  rock: 0x6d6a66,
  waterDeep: 0x1a4a58,
  cloth: 0x8a4034,
  skin: 0xc4a07a,
};

export const TOASTS = {
  move: 'Стик — идти. Правая сторона — смотреть.',
  matter: 'Материя здесь подчиняется весу.',
  bench: 'Верстак позволяет собрать машину.',
};

export const PROGRESS = {
  firstHarvest: { id: 'firstHarvest', need: 3, toast: 'Свет можно унести с собой.' },
  lumberjack: { id: 'lumberjack', need: 2, toast: 'Дерево помнит форму телеги.' },
  firstRide: { id: 'firstRide', need: 25, toast: 'Телега держит путь.' },
  horizon: { id: 'horizon', toast: 'Горизонт открыт.' },
  firstNight: { id: 'firstNight', toast: 'Огонь удержал тьму.' },
};

export const STATES = {
  BOOT: 'boot',
  TITLE: 'title',
  EXPLORE: 'explore',
  GRAB: 'grab',
  INVENTORY: 'inventory',
  CRAFT: 'craft',
  BUILD: 'build',
  DRIVE: 'drive',
  PAUSE: 'pause',
  SHOT: 'shot',
};

export function parseQuery() {
  const q = new URLSearchParams(typeof location !== 'undefined' ? location.search : '');
  return {
    phys: q.get('phys') === '1',
    daySpeed: Math.max(0.05, Number(q.get('daySpeed') || 1) || 1),
    survival: q.get('survival') !== '0',
    quality: (q.get('quality') || '').toUpperCase(),
  };
}

export function parseShot() {
  const hash = typeof location !== 'undefined' ? location.hash || '' : '';
  const known = [
    'shot-title',
    'shot-world',
    'shot-build',
    'shot-vehicle',
    'shot-night',
    'shot-survival',
    'shot-pause',
  ];
  const key = known.find((k) => hash.includes(k));
  return key || null;
}
