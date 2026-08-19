import { RECIPES, isRecipeOpen, recipeById } from '../craft/recipes.js';
import { canPay, pay } from '../craft/resources.js';

export function tryCraft(game, id) {
  const rec = recipeById(id);
  if (!rec) return false;
  if (!isRecipeOpen(rec, game.unlocks)) {
    game.toast('Ещё не время.');
    return false;
  }
  if (!canPay(game.inventory, rec.cost)) {
    game.toast('Не хватает вещества.');
    return false;
  }
  pay(game.inventory, rec.cost);
  if (rec.kind === 'tool') {
    if (!game.tools.includes(rec.id)) game.tools.push(rec.id);
    if (rec.id === 'torch') game.hasTorch = true;
    if (rec.id === 'lantern') game.hasLantern = true;
  } else if (rec.kind === 'part') {
    game.buildStock[rec.part] = (game.buildStock[rec.part] || 0) + 1;
  } else if (rec.kind === 'place') {
    game.queuePlace = rec.id;
    game.toast(rec.id === 'campfire' ? 'Костёр будет поставлен у ног.' : 'Предмет будет поставлен.');
    game.placeCrafted(rec.id);
  }
  game.audio.play('craft');
  return true;
}

export { RECIPES };
