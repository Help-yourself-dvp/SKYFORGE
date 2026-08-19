export const RESOURCE_DEFS = {
  wood: { name: 'Дерево', color: '#8a6238' },
  stone: { name: 'Камень', color: '#8a8478' },
  fiber: { name: 'Волокно', color: '#6b8f5a' },
  fruit: { name: 'Плод', color: '#b84a3a' },
  ore: { name: 'Руда', color: '#6a7080' },
  resin: { name: 'Смола', color: '#c48a3a' },
  water: { name: 'Вода', color: '#4a8aa0' },
  scrap: { name: 'Лом', color: '#8a6a4a' },
};

export const RESOURCE_KEYS = Object.keys(RESOURCE_DEFS);

export function emptyInventory() {
  const o = {};
  for (const k of RESOURCE_KEYS) o[k] = 0;
  return o;
}

export function canPay(inv, cost) {
  for (const k of Object.keys(cost)) {
    if ((inv[k] || 0) < cost[k]) return false;
  }
  return true;
}

export function pay(inv, cost) {
  if (!canPay(inv, cost)) return false;
  for (const k of Object.keys(cost)) inv[k] -= cost[k];
  return true;
}

export function grant(inv, k, n = 1) {
  inv[k] = (inv[k] || 0) + n;
}
