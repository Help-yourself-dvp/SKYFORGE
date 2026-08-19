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

## Known problems

- Rapier WASM раздувает bundle; preview HTML будет большим.
- Heightfield края острова крутые: редкий drift у обрыва лечится fall-respawn.
- Телега на слабом устройстве может требовать MEDIUM quality.
- Без Java/Android SDK локальный `assembleRelease` не подтверждается.
- Push workflow-файла в `.github/workflows/` отклонён GitHub App (нет `workflows` permission). Pipeline лежит в `docs/ci/android.yml`.
