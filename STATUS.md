# STATUS — SKYFORGE 0.1.0

Честный статус на момент alpha.

## WORKING

- Vite 5 + Three 0.160 + Rapier compat + Capacitor 6 каркас
- Версия 0.1.0 (`version.txt`, package, `__APP_VERSION__`)
- Процедурный остров, три зоны, дальние острова
- Terrain collider (heightfield)
- Вода: shader, пруд, ручей, водопад, buoyancy
- Мастерская с горном, ящиками, флюгером
- Игрок: ходьба, прыжок, coyote, fall respawn
- Touch stick + orbit + desktop WASD
- Камера third-person, collision, режимы explore/build/drive
- Grab / charge throw
- Рубка дерева → падение → 3 бревна
- Добыча камня/руды → физические куски
- Физические плоды
- День/ночь 8 минут, небо, солнце/луна
- Ветер на траве, шарфе, флюгере, баллонах
- Трава InstancedMesh + vertex wind
- Флора 4+ видов, рост stage 0–3
- Фауна 3 архетипа, 8 особей, реакция на игрока и машину
- Ночные Shades, страх света
- Survival HUD + fruit/water
- Костёр как источник света
- Конструктор: ghost, snap, 11 типов частей, joints
- Чертёж тележки тем же пайплайном
- Launch / Stop / Seat / drive / exit
- Крафт ≥15 рецептов, топор влияет на рубку
- Save/load localStorage, autosave, Continue
- Синтетический звук
- Shot hooks, DBG ~1/сек
- UI landscape, portrait lock
- Android CI pipeline описан в `docs/ci/android.yml` (перенос в `.github/workflows/` требует permission `workflows`)
- Offline preview builder

## PARTIAL

- Погода (clear/windy/drizzle, дождь частицами, без глубокого wet shading)
- Планер: аэродинамика крыла есть, отдельного носимого планера игрока нет
- Пропеллер: тяга по оси есть, визуал простой
- Инвентарь: компактный, без сложного drag-and-drop
- SSAO: флаг качества заложен, по умолчанию выключен
- Дальние острова: визуальные, без полноценного визита
- Joint break при огромном ударе: порог высокий, явного teardown мало
- Adaptive quality переключает тени/bloom/particles, не все LOD острова
- Android Gradle-сборка зависит от CI/локального SDK

## STUB

- Сложный носимый player-glider как отдельный предмет
- Voxel excavation
- Уникальный визуал каждого из 15 крафтов
- SMAA как отдельный pass

## NOT IMPLEMENTED

- Сетевой код, аккаунты, реклама
- Внешние модели/текстуры/музыка
- Полноценный летающий корабль
- Настоящий fluid solver

## DEVICE STABILIZATION PASS

Broken baseline: `b2314dea1e32348d6f8a5c8621b67a8cfba70338` (build `b2314de`, "fix: stop 8s Honor freeze from bloom and quality switch" — freeze сохранялся на устройстве).

Симптом: freeze через ~5–7 с gameplay на Honor Magic 8 Pro даже без действий; камера при некоторых углах уходит под/сквозь поверхность острова и показывает пустоту под terrain.

### Root cause (установлен воспроизводимо, headless soak на реальных системах)

Главный механизм зависания: **любое необработанное исключение в `update()`/`render()` навсегда убивает requestAnimationFrame-цепочку** — `Game.start()` не имел try/catch (коммит-сообщение предыдущей ветки утверждало обратное, но кода не было). Игра «зависала» при первом же брошенном исключении. Найдены и исправлены конкретные броски:

1. **Rapier WASM panic в fauna** (главный idle-freeze): `Fauna._ai` держал список фруктов `fruits`, отфильтрованный один раз за тик; когда одно животное съедало фрукт (`collectProp` → `removeRigidBody`), следующее животное в том же тике вызывало `body.translation()` на удалённом теле → Rust panic `RuntimeError: unreachable` → необработанное исключение → freeze. Воспроизведено headless при t≈10 с idle; на устройстве (иные FPS/тайминги) — 5–7 с.
2. **Launch машины**: `p.body.setCcdEnabled(true)` — метода нет в rapier3d-compat 0.14 (CCD задаётся на `RigidBodyDesc`) → TypeError при каждом «Пуск» → freeze.
3. **Heightfield транспонирован**: `Island` хранил высоты x-fast, Rapier ждёт z-fast (`heights[zi + xi*(ncols+1)]`) → коллайдер острова был искажён на 1–3.5 м относительно визуала → предметы/машины «плавали», камера упиралась в неверную поверхность.
4. **Raycast'ы Rapier молчат, пока мир не сделал хотя бы один `step()`** (broadphase не инициализирован) → на title/pause камера и interact не видят коллайдеров.
5. **Колёса машин**: коллайдер-цилиндр создавался без поворота (ось Y вместо оси качения X) → машина раскачивалась на «доньях»; вдобавок `configureMotorVelocity/configureMotorPosition` существуют только у multibody-джойнтов, у impulse-джойнтов их нет — моторы колёс и руль фактически не работали.
6. **Чертёж тележки**: порты дублировались (часть joint'ов молча дропалась), геометрия не совпадала с якорями портов, fixed-joint'ы между частями с разным yaw заставляли солвер разворачивать части → телега «взлетала» и падала с острова.

### Fix (конкретные изменения)

- `src/world/fauna.js`: фрукты prune из списка при съедании + проверка `byId.has(e.id)`; `PhysicsWorld.removeEntity` обнуляет `ent.body/collider` после удаления — устаревшие ссылки падают как JS null, а не WASM panic.
- `src/build/machine.js`: CCD на `RigidBodyDesc` при создании части; убран `setCcdEnabled` из `launch()`. Колёса: цилиндр повёрнут на ось X; привод — свой velocity-контроллер с traction control (срез тяги при крене) + yaw-assist руля; нет мотора impulse-джойнтов.
- `src/world/island.js`: `addCollider` транспонирует высоты в формат Rapier; высоты за обрывом теперь конически уходят вниз (нет плоской «пустоты»); `_volumeShell` начинается у самой кромки и обнимает профиль поверхности (soil→rock→deep), днище до −16.
- `src/physics/world.js` + `game.js`: `warm()` — один step после построения мира, чтобы raycast'ы работали с первого кадра (включая title); `Game.start()` обёрнут в try/catch — цикл живёт, ошибка логируется один раз (`dbg.noteError`), при 90+ повторах отключается пост-процесс.
- `src/build/blueprints.js`/`parts.js`/`joints.js`: тележка пересобрана — все 8 joint'ов с уникальными портами, якоря совпадают, все части с identity-rotation; fixed-joint дополнительно фиксирует текущую относительную ориентацию (frame quat = qB⁻¹·qA) для ручной сборки.
- `src/player/camera.js`: raycast вперёд + назад (backward probe), `_blocksCamera` (terrain/workshop/rock/ore/tree/crate/log/chunk), жёсткий запрет «камера ниже terrain+0.7», плавное возвращение дистанции. Workshop floor добавлен в physics.sync, чтобы камера его не пробивала.
- Горячий цикл: убраны аллокации в `interact.update`, `sky._cloudBetween`, `ghost_ctrl.update`, `machine.drive`, campfire-частицы (scratch vectors).
- `src/dbg.js`: полная строка DBG (bodies/colliders/joints/threeObjects/drawCalls/triangles/particles/timers/audioNodes), `collect()`, watchdog-снимок при длинном кадре, `noteError`; `window.__SKY.getDiagnostics()`.
- `src/gfx/shaders.js`/`flora.js`/`particles.js`: трава темнее, мельче, зелёно-охристая (не белые штрихи); pollen/firefly меньше; HUD — лёгкие визуальные круги при сохранении hit-области ≥64px.
- `src/audio.js`: `activeNodes()` для диагностики.

### Camera defect

Камера проходила под terrain из-за (а) искажённого транспонированного heightfield, (б) мёртвых raycast'ов до первого step, (в) отсутствия обратной проверки «ниже поверхности». Теперь: spring-arm с двумя Rapier-лучами (target→desired и desired→target), clamp `y ≥ heightAt(x,z)+0.7`, workshop в camera-collision set. Headless-свип: 1728 комбинаций yaw/pitch в 6 точках (включая край острова) — проникновений ниже terrain нет.

### Island underside

Визуальный объём: terrain-поверхность (трава/почва у кромки/камень на склонах), `_volumeShell` — irregular оболочка от кромки (soil) через rock к deep-днищу с вершиной −16, 14 скальных пиков. За обрывом высоты конически уходят вниз — при взгляде сбоку/снизу остров читается массой, а не тонкой зелёной плоскостью. Дублирующего physics terrain нет.

### Результаты проверки (headless, реальные системы Three+Rapier в Node)

- Soak idle / night / drive / chaos по 130 симулированных секунд: 0 throws, 0 NaN, counts без runaway (bodies 86→72 стабильно после съедания фруктов, plants/animals фиксированы, particles ≤15).
- Тележка: drives 24+ м по земле за 20 с (норма DoD ≥15 м), руль поворачивает, выход в walk работает, при падении с острова — machineLost → respawn у мастерской.
- Камера: 0 м проникновения под terrain.

### Остаточные риски (честно)

- Реальный браузер/WebView в этой среде недоступен (нет Chromium/libnss3, сеть только npm+github) — GPU-специфичные hang'и (Adreno WebGL driver) по-прежнему нельзя исключить; нужен повторный прогон APK на Honor Magic 8 Pro.
- Телега: устойчивость проверена на SKY-001 у мастерской; на крутых склонах или при ударах о деревья поведение жёсткой машины без подвески может быть резким (руль слегка «дергает»).
- Heightfield-обрыв: редкий drift у кромки лечится fall-respawn (как и раньше).
- Часть «ремонта» (joint frame quats, traction control) — инженерные ассисты, а не идеальная физика; для полноценной подвески нужен будущий pass.

## Known problems

- Rapier WASM раздувает bundle; preview HTML будет большим (~2.6 МБ).
- Heightfield края острова крутые: редкий drift у обрыва лечится fall-respawn.
- Телега на слабом устройстве может требовать MEDIUM quality.
- В песочнице нет локального Android SDK/Java, а `dl.google.com` и apt заблокированы —
  локальный `./gradlew assembleRelease` здесь невозможен. APK собирает CI:
  последний успешный прогон `32347801794` (commit `e1278e3`), артефакт `skyforge-0.1.0`.
  Certificate SHA-256 подтверждён шагом fingerprint в CI = `tools/expected_cert.txt`
  (`88:f0:cc:2e:9e:1c:da:f7:0d:ac:4f:bc:79:c8:43:e1:0f:b5:19:40:ce:14:5b:7c:fb:13:2c:93:f3:6f:ad:93`).
- Первый APK: островная «юбка» бросала тень на весь верх; adaptive quality dispose shadow map вешал Honor WebView — обе проблемы закрыты в текущей ветке (composer выключен на Android, quality заморожена после boot).
