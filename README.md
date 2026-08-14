# Battle Forge

[English](#english) · [Русский](#russian)

Battle Forge is a real-time encounter manager for tabletop role-playing games. It provides separate interfaces for the game master, players, and a shared battle display, while Firebase Realtime Database synchronizes the encounter state between them.

> **Open-source status:** the project is developed publicly and contributions are welcome. The repository does not have a LICENSE file yet, so it is not formally licensed for reuse or redistribution. Add an OSI-approved license, such as MIT or Apache-2.0, before presenting releases as fully open source.

---

<a id="english"></a>

## English

### What the application does

- **Game master (/dm)** — creates encounters, manages combatants, initiative, health, conditions, and the active turn.
- **Shared display (/display)** — shows the current encounter state to everyone at the table.
- **Player (/player)** — gives players a focused view of their characters and the battle.
- **Real-time synchronization** — propagates encounter changes through Firebase Realtime Database.

### Technology

- Angular 20
- TypeScript and RxJS
- Firebase Realtime Database
- Vitest with the AnalogJS Angular testing integration
- Firebase Local Emulator Suite
- SCSS

### Requirements

- Node.js 24 is recommended and is used in CI
- npm
- Java 21 for Firebase Emulator tests

### Getting started

Install the exact dependency versions from the lock file:

~~~bash
npm ci
~~~

Create the local Angular environment files:

~~~text
src/environments/environment.ts
src/environments/environment.prod.ts
~~~

They must export the Firebase configuration expected by the application. These files are intentionally ignored by Git because they are environment-specific. GitHub Actions generates temporary versions during CI.

Start the development server:

~~~bash
npm start
~~~

Then open one of the application routes:

- http://localhost:4200/dm
- http://localhost:4200/display
- http://localhost:4200/player

### Testing

The project uses two complementary test levels:

1. **Unit and component tests** run with Vitest in jsdom. Firebase-facing dependencies are replaced at the application boundary so tests validate application behavior rather than a hand-written imitation of the Firebase SDK.
2. **Firebase integration tests** use the real Firebase Web SDK against a local Realtime Database Emulator. They verify reads, writes, subscriptions, and database rules without accessing the production Firebase project.

The emulator uses the demo project ID **demo-battle-forge**. It runs locally, does not consume production quota, and does not require a paid Firebase plan. On its first run, firebase-tools may download the emulator binary.

Useful commands:

| Command | Purpose |
| --- | --- |
| **npm test** | Run Vitest in watch mode |
| **npm run test:run** | Run all unit/component tests once |
| **npm run test:ui** | Open the Vitest UI |
| **npm run test:coverage** | Run tests and write an HTML coverage report to coverage/ |
| **npm run test:ci** | Run the deterministic unit-test command used by CI |
| **npm run test:firebase** | Start the Realtime Database Emulator, run integration tests, and stop it |
| **npm run test:all** | Run unit tests with coverage and Firebase integration tests |
| **npm run emulator:firebase** | Keep the local Realtime Database Emulator running for manual work |

Firebase test configuration lives in:

- **firebase.test.json** — emulator host, port, and test rules
- **database.rules.test.json** — isolated rules used only by integration tests
- **vitest.firebase.config.ts** — Vitest configuration for emulator tests

The regular Vitest setup is defined in **vite.config.ts** and **src/test-setup.ts**.

### Build

~~~bash
npm run build
~~~

For the GitHub Pages production build:

~~~bash
npm run build:prod
~~~

### CI/CD

The workflow in **.github/workflows/deploy.yaml**:

1. installs dependencies with npm ci;
2. generates CI environment files;
3. runs Vitest unit tests with coverage;
4. runs Firebase Realtime Database Emulator integration tests;
5. builds the Angular application;
6. deploys to GitHub Pages only for pushes to **master**.

Pull requests perform validation but do not deploy. Emulator tests stay completely local to the GitHub Actions runner and do not use a real Firebase project or billing account.

### Project structure

~~~text
src/app/
├── core/       # models, services, and shared application logic
├── features/   # route-level DM, display, and player features
└── shared/     # reusable UI and utilities
~~~

### Contributing

Issues and pull requests are welcome. Before submitting a change:

~~~bash
npm ci
npm run test:all
npm run build
~~~

Please keep secrets and local Firebase environment files out of commits.

### License

No license has been selected yet. Until a **LICENSE** file is added, standard copyright restrictions apply even though the source code is publicly visible. Choosing a license is the remaining step required to make the project legally open source.

Battle Forge is an unofficial fan-made project and is not affiliated with or endorsed by Wizards of the Coast.

---

<a id="russian"></a>

## Русский

### О проекте

Battle Forge — приложение для управления боевыми сценами в настольных ролевых играх в реальном времени.

- **Мастер (/dm)** — создаёт сражение, управляет участниками, инициативой, здоровьем, состояниями и текущим ходом.
- **Общий экран (/display)** — показывает актуальное состояние боя всем участникам за столом.
- **Игрок (/player)** — предоставляет игроку отдельный интерфейс для его персонажей и сражения.
- **Синхронизация** — Firebase Realtime Database передаёт изменения между всеми открытыми клиентами.

### Технологии

- Angular 20
- TypeScript и RxJS
- Firebase Realtime Database
- Vitest и Angular-интеграция AnalogJS
- Firebase Local Emulator Suite
- SCSS

### Требования

- Рекомендуется Node.js 24 — эта версия используется в CI
- npm
- Java 21 для интеграционных тестов с Firebase Emulator

### Локальный запуск

Установите точные версии зависимостей из lock-файла:

~~~bash
npm ci
~~~

Создайте локальные файлы окружения Angular:

~~~text
src/environments/environment.ts
src/environments/environment.prod.ts
~~~

Они должны экспортировать Firebase-конфигурацию, которую ожидает приложение. Файлы намеренно добавлены в **.gitignore**, потому что зависят от окружения. В GitHub Actions временные версии этих файлов создаются автоматически.

Запустите dev-сервер:

~~~bash
npm start
~~~

Основные маршруты:

- http://localhost:4200/dm
- http://localhost:4200/display
- http://localhost:4200/player

### Тестирование

В проекте используются два уровня тестов:

1. **Unit- и component-тесты** запускаются через Vitest в jsdom. Firebase-зависимости подменяются на границе приложения, поэтому тестируется логика приложения, а не самодельная копия поведения Firebase SDK.
2. **Интеграционные тесты Firebase** работают с настоящим Firebase Web SDK и локальным эмулятором Realtime Database. Они проверяют чтение, запись, подписки и database rules без обращения к production-проекту.

Эмулятор использует демонстрационный project ID **demo-battle-forge**, работает только локально, не расходует production-квоты и не требует платного тарифа Firebase. При первом запуске firebase-tools может скачать бинарный файл эмулятора.

Команды:

| Команда | Назначение |
| --- | --- |
| **npm test** | Vitest в watch-режиме |
| **npm run test:run** | Однократный запуск unit- и component-тестов |
| **npm run test:ui** | Интерфейс Vitest UI |
| **npm run test:coverage** | Тесты и HTML-отчёт о покрытии в coverage/ |
| **npm run test:ci** | Детерминированный запуск unit-тестов для CI |
| **npm run test:firebase** | Запуск эмулятора RTDB, интеграционных тестов и остановка эмулятора |
| **npm run test:all** | Unit-тесты с coverage и интеграционные Firebase-тесты |
| **npm run emulator:firebase** | Постоянный запуск RTDB Emulator для ручной разработки |

Конфигурация Firebase-тестов:

- **firebase.test.json** — адрес, порт и правила тестового эмулятора
- **database.rules.test.json** — изолированные правила для интеграционных тестов
- **vitest.firebase.config.ts** — отдельная конфигурация Vitest

Основная конфигурация Vitest находится в **vite.config.ts** и **src/test-setup.ts**.

### Сборка

Обычная production-сборка:

~~~bash
npm run build
~~~

Сборка для GitHub Pages:

~~~bash
npm run build:prod
~~~

### CI/CD

Workflow **.github/workflows/deploy.yaml**:

1. устанавливает зависимости через npm ci;
2. создаёт временные environment-файлы;
3. запускает unit-тесты Vitest с coverage;
4. запускает интеграционные тесты в Firebase Realtime Database Emulator;
5. собирает Angular-приложение;
6. деплоит GitHub Pages только при push в **master**.

В pull request выполняются проверки без деплоя. Firebase Emulator запускается локально на GitHub Actions runner и не использует настоящий Firebase-проект или биллинг.

### Структура проекта

~~~text
src/app/
├── core/       # модели, сервисы и общая логика приложения
├── features/   # страницы мастера, общего экрана и игрока
└── shared/     # переиспользуемые UI-компоненты и утилиты
~~~

### Участие в разработке

Issues и pull requests приветствуются. Перед отправкой изменений выполните:

~~~bash
npm ci
npm run test:all
npm run build
~~~

Не добавляйте в коммиты секреты и локальные Firebase environment-файлы.

### Лицензия и open-source статус

Проект разрабатывается публично и открыт для контрибьюторов, но лицензия пока не выбрана. Пока в репозитории нет файла **LICENSE**, по умолчанию действуют обычные ограничения авторского права — даже если исходный код доступен публично. Чтобы проект юридически стал open source, нужно выбрать и добавить OSI-совместимую лицензию, например MIT или Apache-2.0.

Battle Forge — неофициальный фанатский проект, не связанный с Wizards of the Coast и не одобренный компанией.
