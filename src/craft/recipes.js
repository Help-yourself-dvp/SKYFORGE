export const RECIPES = [
  { id: 'axe', name: 'Топор', cost: { wood: 3, stone: 2 }, kind: 'tool', unlock: true },
  { id: 'hammer', name: 'Молот', cost: { wood: 2, stone: 3 }, kind: 'tool', unlock: true },
  { id: 'torch', name: 'Факел', cost: { wood: 1, resin: 1 }, kind: 'tool', unlock: true },
  { id: 'campfire', name: 'Костёр', cost: { wood: 4, stone: 2 }, kind: 'place', unlock: true },
  { id: 'plank', name: 'Доска', cost: { wood: 2 }, kind: 'part', part: 'PLANK', unlock: true },
  { id: 'block', name: 'Брус', cost: { wood: 2, stone: 1 }, kind: 'part', part: 'BLOCK', unlock: true },
  { id: 'wheel', name: 'Колесо', cost: { wood: 3, resin: 1 }, kind: 'part', part: 'WHEEL', unlock: true },
  { id: 'motor', name: 'Мотор', cost: { ore: 2, scrap: 2, stone: 1 }, kind: 'part', part: 'MOTOR', unlock: true },
  { id: 'seat', name: 'Сиденье', cost: { wood: 3, fiber: 2 }, kind: 'part', part: 'SEAT', unlock: true },
  { id: 'steer', name: 'Руль', cost: { wood: 2, scrap: 1 }, kind: 'part', part: 'STEER', unlock: true },
  { id: 'spring', name: 'Пружина', cost: { ore: 1, scrap: 2 }, kind: 'part', part: 'SPRING', unlock: true },
  { id: 'balloon', name: 'Баллон', cost: { fiber: 4, resin: 2 }, kind: 'part', part: 'BALLOON', unlock: true },
  { id: 'strut', name: 'Тяга', cost: { wood: 2, ore: 1 }, kind: 'part', part: 'STRUT', unlock: true },
  { id: 'collector', name: 'Сборщик воды', cost: { stone: 3, scrap: 1 }, kind: 'place', unlock: true },
  { id: 'lantern', name: 'Фонарь', cost: { ore: 1, resin: 2, scrap: 1 }, kind: 'tool', unlock: 'firstHarvest' },
  { id: 'propeller', name: 'Пропеллер', cost: { wood: 4, ore: 2 }, kind: 'part', part: 'PROPELLER', unlock: 'firstRide' },
  { id: 'glider', name: 'Крыло', cost: { fiber: 6, wood: 3, resin: 2 }, kind: 'part', part: 'GLIDER_WING', unlock: 'firstNight' },
  { id: 'crate', name: 'Ящик', cost: { wood: 4 }, kind: 'place', unlock: true },
];

export function recipeById(id) {
  return RECIPES.find((r) => r.id === id) || null;
}

export function isRecipeOpen(recipe, unlocks) {
  if (recipe.unlock === true || recipe.unlock == null) return true;
  return !!(unlocks && unlocks[recipe.unlock]);
}
