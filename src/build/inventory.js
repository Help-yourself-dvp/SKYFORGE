import { PART_ORDER } from './parts.js';

export function emptyBuildStock() {
  const o = {};
  for (const k of PART_ORDER) o[k] = 0;
  o.BLOCK = 8;
  o.PLANK = 8;
  o.STRUT = 6;
  o.WHEEL = 6;
  o.MOTOR = 2;
  o.SEAT = 2;
  o.STEER = 2;
  o.SPRING = 4;
  o.BALLOON = 2;
  o.PROPELLER = 0;
  o.GLIDER_WING = 0;
  return o;
}

export function grantPart(stock, type, n = 1) {
  stock[type] = (stock[type] || 0) + n;
}

export function takePart(stock, type) {
  if ((stock[type] || 0) <= 0) return false;
  stock[type] -= 1;
  return true;
}
