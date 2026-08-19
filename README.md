# SKYFORGE — Кузница Небес

Версия **0.1.0**. Офлайн мобильная 3D-песочница: физический мир, живой архипелаг и настоящий конструктор механизмов.

Пакет: `com.skyforge.game`  
Целевое устройство alpha: Honor Magic 8 Pro (landscape, immersive, без сети).

## Игра

Игрок оказывается на парящем острове. Можно ходить, брать предметы, рубить деревья, собирать машину из физических деталей, сесть в неё и ехать по тому же миру.

Сид по умолчанию: `SKY-001`.

## Управление

**Сенсор**

- Левый стик — ходьба
- Правая половина — камера
- ПРЫЖОК / ДЕЙСТВИЕ / СБОРКА / УДАР
- СУМКА, ПАУЗА
- Back — пауза

**Desktop debug**

- WASD — ходьба
- Мышь (правая зона / drag) — камера
- Space — прыжок
- E — действие
- B — строительство
- I — инвентарь
- F / Q — удар
- Esc — пауза

## Сборка

```bash
npm ci
npm run build
python3 tools/build_preview.py
```

Dev:

```bash
npm run dev
```

Single-file offline preview: `preview/skyforge.html`.

## Android / APK

```bash
npm run build
npx cap sync android
npm run android:build
```

CI: `docs/ci/android.yml` (копия для `.github/workflows/android.yml`; сам workflow-файл GitHub App этой сессии не принимает без permission `workflows`).

- Node 20, Java 17
- `npm ci` → `npm run build` → `npx cap sync android` → `assembleRelease`
- Артефакт: `skyforge-0.1.0.apk`
- Release создаётся только при `workflow_dispatch` + `publish_release=true`

Локально `versionCode = 1`. В Actions `versionCode = github.run_number`.

## Подпись

Стабильный alpha debug keystore:

- файл: `tools/debug.keystore`
- password: `debugstore`
- alias: `androiddebugkey`

Fingerprint сертификата (SHA-256):

`88f0cc2e9e1cdaf70dac4fbc79c843e10fb51940ce145b7cfb132c93f36fad93`

См. также `tools/expected_cert.txt`.  
Сравнивается SHA-256 **сертификата**, не raw hash `CERT.RSA`.

Если в Actions задан секрет `DEBUG_KEYSTORE_BASE64` — используется он.

## Установка на Honor Magic 8 Pro

1. Скачайте APK из Actions artifact (или Release, если он создан).
2. На телефоне: Настройки → Безопасность → разрешить установку из этого источника.
3. Откройте `skyforge-0.1.0.apk` и установите.
4. Запускайте в альбомной ориентации.

Игра полностью офлайн. Разрешения не запрашиваются.

## Debug

- `?phys=1` — физический debug
- `?daySpeed=20` — ускорить сутки
- `?survival=0` — отключить спад голода/жажды
- `#shot-world` `#shot-build` `#shot-vehicle` `#shot-night` и др.

`window.__SKY = { game, dbg }`

## Документы

- `ОПИСАНИЕ.md` — продукт
- `GDD.md` — дизайн
- `AI_GUIDE.md` — архитектура для следующего агента
- `STATUS.md` — честный статус систем
- `ЧЕКЛИСТ_ТЕСТОВ.md` — приёмка
- `RELEASE_NOTES.md` — 0.1.0
