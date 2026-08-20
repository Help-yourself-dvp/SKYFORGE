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

Broken baseline: `8e45d1e3fd463eaf93c60688d7ab7a13ea51ae30`

Симптом: freeze через 5–7 с gameplay на Honor Magic 8 Pro; камера уходит под terrain.

Root cause (наиболее вероятная, по аудиту кода, не по device trace):

1. Каждый кадр создавался новый `RAPIER.Ray` в camera/interact. Rapier JS обёртки держат WASM-память; на WebView GC опаздывает → рост кучи и зависание через несколько секунд.
2. Каждый footstep/`_noise` выделял новый `AudioBuffer` + BufferSource + Filter + Gain. Ходьба = шторм audio nodes.
3. `daynight._eval`, `sky.update`, `camera.update`, `physics.sync.apply` плодили `new Color/Vector3/Quaternion` каждый frame.
4. Camera collision не проверяла «камера ниже heightmap» и слабо отталкивалась от terrain.

Fix:

- один переиспользуемый Rapier.Ray;
- один шумовой AudioBuffer + cap живых SFX-нод (18);
- scratch vectors/colors;
- particle pool + hard cap 220;
- physics step без EventQueue, accumulator clamp 0.05 / max 3 substeps / backlog reset;
- один RAF, cancel перед стартом;
- spring-arm: Rapier ray + запрет y < terrain+0.85 + плавное возвращение дистанции;
- fade ствола/кроны, если дерево между камерой и игроком;
- визуальный объём острова: irregular cliff shell + скальное днище (без второго physics terrain).

Idle freeze ~7–10s on Honor (no touch): matches ~480 frames then `adapt()` changing shadow map size / EffectComposer `setSize` after immersive resize. Android now skips composer entirely, quality is fixed after boot, resize no-ops if dimensions unchanged, game loop catches exceptions so one throw cannot kill RAF.

Остаточные риски: без device trace нельзя исключить GPU/WebView hang от InstancedMesh grass. Soak 60s в этой среде без WebGL не прогонялся.

## Known problems

- Rapier WASM раздувает bundle; preview HTML будет большим.
- Heightfield края острова крутые: редкий drift у обрыва лечится fall-respawn.
- Телега на слабом устройстве может требовать MEDIUM quality.
- Без Java/Android SDK локальный `assembleRelease` не подтверждается.
- Push workflow-файла в `.github/workflows/` отклонён GitHub App (нет `workflows` permission). Pipeline лежит в `docs/ci/android.yml`.
- Первый APK: островная «юбка» бросала тень на весь верх — кадр уходил в чёрный; adaptive quality dispose shadow map вешал Honor WebView. Исправлено в текущей ветке.
