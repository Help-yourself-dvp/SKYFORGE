import { SAVE_KEY, VERSION, DEFAULT_SEED } from './config.js';

export function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object') return null;
    return data;
  } catch (e) {
    console.warn('save load failed', e);
    return null;
  }
}

export function writeSave(data) {
  try {
    const payload = { ...data, version: VERSION, savedAt: Date.now() };
    localStorage.setItem(SAVE_KEY, JSON.stringify(payload));
    return true;
  } catch (e) {
    console.warn('save write failed', e);
    return false;
  }
}

export function clearSave() {
  try { localStorage.removeItem(SAVE_KEY); } catch (_) { /* */ }
}

export function emptySave(seed = DEFAULT_SEED) {
  return {
    version: VERSION,
    seed,
    timeOfDay: 0.28,
    weather: 'clear',
    player: {
      x: 0, y: 12, z: 0, yaw: 0,
      health: 100, hunger: 100, thirst: 100,
    },
    inventory: {
      wood: 0, stone: 0, fiber: 0, fruit: 0, ore: 0, resin: 0, water: 0, scrap: 0,
    },
    tools: [],
    unlocks: {},
    machines: [],
    world: {
      cutTrees: [],
      plantStages: {},
      fauna: [],
      seenHorizon: 0,
    },
    lastSafePos: { x: 0, y: 12, z: 0 },
    progress: { fruit: 0, trees: 0, driven: 0, nightFire: 0 },
  };
}
