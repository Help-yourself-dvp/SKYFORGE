# AI_GUIDE — как работать с SKYFORGE

## Старт следующего агента

1. `git fetch`
2. `git reset --hard origin/<current-branch>` если ветка уже на origin
3. Одно крупное дело за заход
4. `npm run build`
5. По возможности preview / android sync
6. `git add -A && git commit && git push`
7. Не оставлять грязное дерево

Не разрушай чужой проект, если репозиторий вдруг не SKYFORGE.

## Архитектура

`main.js` только bootstrap. `game.js` собирает системы.

Почти у каждой крупной системы: `init` / конструктор, `update`, `dispose`.

Единственная debug-глобаль: `window.__SKY = { game, dbg }`.

## userData

Пишите поля в `object.userData`, **не** подменяйте объект целиком.

Контракт:

- `kind` — terrain | tree | log | fruit | part | fauna | enemy | workshop | water | player | plant | campfire | ...
- `physId` — id сущности в `physics.sync`
- `grabbable`, `mass`, `resource`, `partType`, `partId`

## Physics groups

`src/config.js` → `GROUPS` + `interactionGroups(membership, filter)`.

Rapier: `@dimforge/rapier3d-compat`. Сначала `await RAPIER.init()`. Фиксированный шаг 1/60, max 3 substeps.

Joints: `build/joints.js` (fixed / revolute / spring / prismatic).

## Как добавить

**Ресурс** — `craft/resources.js`, спавн в `world/resources.js`.

**Рецепт** — объект в `craft/recipes.js`.

**Животное** — архетип в `world/fauna.js`.

**Враг** — `world/enemies.js`.

**Деталь машины** — `build/parts.js` + stock в `build/inventory.js`.

**Чертёж** — список place+connect в `build/blueprints.js`. Не делать отдельную Car-сущность.

## Offline preview

Один Vite bundle, `inlineDynamicImports: true`, без `import()`.

`python3 tools/build_preview.py` вставляет JS/CSS строками, без хрупких regex по минифицированному коду сверх замены link/script тегов.

Не импортировать Capacitor plugins в web bundle. Только `window.Capacitor.Plugins.*` если runtime есть.

## Rapier

Не смешивать cannon-es. CCD на быстрых частях. Sleeping включён движком. Буойанси — сила в сенсоре пруда, не fluid solver.

Character controller kinematic capsule: coyote, jump buffer, autostep.

## Git

Ветка сессии фиксирована. Коммитьте играбельное состояние. STATUS.md должен быть честным: WORKING / PARTIAL / STUB / NOT IMPLEMENTED.
