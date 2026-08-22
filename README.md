# Battle Forge

[English](#english) · [Русский](#russian)

Battle Forge is a local-first, real-time companion for running D&D encounters at the table. It combines a desktop-oriented DM console, a mobile player sheet, a shared battle display, reusable content libraries, and a local story slideshow.

The application is currently an alpha intended for private games with friends. It favors fast manual control over full rules automation: players and the DM still roll dice and decide damage at the table, while Battle Forge tracks shared state, turns, health, resources, effects, and presentation.

---

<a id="english"></a>

## English

### Interfaces

| Route | Purpose |
| --- | --- |
| `/dm` | Desktop DM console for preparation, combat, rewards, libraries, and story presentation |
| `/player` | Mobile-friendly character sheet and personal combat screen |
| `/display` | Shared full-screen battle board or story image shown to the table |

The root route redirects to `/player`.

### DM console

The DM workspace is organized in the same order in which a session is normally prepared and played.

#### 1. Scenes and creatures

- Create reusable creature templates with HP, AC, subtype, resistances, initial states, attacks, damage formulas, attack bonuses, and abilities.
- Add saved weapon or attack templates to a creature.
- Edit and delete creature templates without rebuilding every encounter from scratch.
- Assemble creatures into named scene presets such as a forest ambush or tavern fight.
- Configure any quantity of a creature in a scene; launching the scene creates separate combatant copies.
- Edit an existing scene and add new creatures to it.
- Add one creature or an entire saved scene to the current battle.

#### 2. Combat

- Automatically synchronize stored players into the battle room.
- Roll initiative, edit individual results, confirm the order, reorder participants manually, and choose the current turn.
- Show players and enemies in one initiative roster.
- Advance turns and rounds through a shared start/end-turn pipeline; dead participants are skipped.
- Apply manual damage, healing, temporary HP, mass enemy damage, or changes to several selected targets.
- Clamp healing to the combatant's maximum HP.
- Track knockout, stable/dead states, death saves, natural 1/20 outcomes, revival, and return to combat.
- Undo the latest supported HP action and inspect the combat journal.
- End a battle, completely reset the room, or finish a scene while preserving players.
- Finish a scene with no rest, a short rest, or a long rest. Rest recovery updates spell slots and configured character resources.

#### Status effects and turn damage

- Assign effects to either players or enemies.
- Built-in effects include poison, burning, freezing, fear, bleeding, stunned, restrained, blessed, prone, blinded, paralyzed, invisible, charmed, grappled, unconscious, exhausted, incapacitated, deafened, and petrified.
- Configure damage per trigger, trigger count, start/end-of-turn timing, source, concentration owner, saving throw, DC, and DM notes.
- Keep an effect active until the DM removes it by setting its trigger count to zero.
- Damage-over-time effects are processed by the turn handler and player HP is persisted.
- Active effects are synchronized to the player and shared display with distinct styling and animation.

#### 3. Players and rewards

- Maintain a reusable Firebase item library with name, icon, rarity, description, formula, default quantity, stackability, and consumable behavior.
- Quickly give a saved item to any player or create a one-off item directly from the DM console.
- Give saved or manually entered spells to a player.
- Configure spell-slot pools from levels 1–9 and choose long-rest or Pact Magic short-rest recovery.
- Create, edit, refill, and delete character resources such as Rage, Lay on Hands, Focus Points, Channel Divinity, or a custom counter.
- Resource presets provide useful starting values without locking the DM into class automation.
- Resources support custom icons, descriptions, finite or unlimited use, fixed or player-selected spending, manual/short/long-rest recovery, partial short-rest recovery, and linked slot-free spells.
- A resource can activate a visible combat effect until manually ended, until the end of the next turn, or for a configured number of rounds.

#### 4. Open5E translation workspace

- Search Open5E for SRD 2014/2024 spells, weapons, and creatures.
- Compare the English source and an editable translation in two columns.
- Paste a prepared Russian translation, adjust rules text, and save it once to the personal Firebase library.
- Save spells and immediately give them to a selected player.
- Save weapon/action templates for later creature construction.
- Save translated creatures directly as reusable creature templates.
- Reuse saved content without another Open5E request.

Open5E search requires internet access. The saved personal libraries do not.

#### 5. Story presentation and DM script

- Load JPG, PNG, WebP, and other browser-supported images from the DM's computer.
- Reorder slides with buttons or drag and drop, select the active slide, and remove slides.
- Switch `/display` between battle and story mode at any time from the persistent presentation bar.
- Navigate previous/next slides without leaving another DM workspace.
- Fit landscape and portrait images completely inside Full HD and 2K displays without cropping; a blurred backdrop fills unused space.
- Keep image bytes local: Firebase Storage is not required.
- Synchronize the deck and selected slide between same-origin DM and display tabs through `BroadcastChannel`.
- Associate a persistent story section with each image using the filename without its extension (`1.png` → section `1`).
- Write the DM script with a safe Markdown subset: headings, paragraphs, bold, italic, inline code, quotes, ordered/unordered lists, and separators.
- After saving, the editor collapses into a rendered teleprompter; press **Edit** to change the section again.

Story images live only in browser memory and must be loaded again after a full reload. The story text is stored in Firebase. Image synchronization is intended for DM and display tabs on the same device/browser; it is not transferred through Firebase to another computer.

### Player screen

#### Login and character import

- Log in by the exact stored character name.
- Remember the last successful character in `localStorage` and offer a one-tap **Log in as …** button after restarting the PWA.
- Keep manual login available for another player; a successful login replaces the remembered name.
- Continue normal login if Safari/private settings make local storage unavailable.
- Upload a Long Story Short JSON character when the name is not yet stored.
- Recover common trailing-comma JSON errors and normalize missing optional arrays and legacy data before Firebase writes.
- Parse embedded stats, HP, AC, speed, weapons, abilities, inventory, spells, resistances, race, class, and level.

Battle Forge does not call authenticated Long Story Short endpoints to resolve remote spell IDs. Missing spell text should be added through the DM spell/Open5E library.

#### Character sheet

- Show Russian stat abbreviations and modifiers, HP/max HP, temporary HP, AC, speed, and resistances.
- Display weapon damage formulas with Russian ability abbreviations such as `1d8 + СИЛ`.
- Show inventory quantities, rarity, formulas, examine details, and consumable use.
- Show expandable abilities and compact spell descriptions suitable for a phone.
- Highlight dice notation inside spell damage and descriptions.

#### Spells and spell slots

- Cantrips are unlimited and do not spend a slot.
- Leveled spells spend one available shared slot of the spell's level or higher.
- The player can choose which valid slot level to spend.
- A modal confirms the spell, spent slot level, or linked free-use resource.
- Automatic D&D 2024 slot defaults are generated for supported single-class characters:
  - full casters: Bard, Cleric, Druid, Sorcerer, Wizard;
  - half casters: Paladin, Ranger;
  - Pact Magic: Warlock, with short-rest recovery.
- The DM can always correct slot pools manually.

Multiclass slot calculation is intentionally not automated in the current alpha.

#### Character resources

- Show each configured resource with its DM-selected icon and description.
- Disable and visually mute depleted finite resources.
- Support unlimited abilities and variable pools such as Lay on Hands.
- Show a confirmation modal after use.
- Display an activated resource as a combat effect; allow the player to extend or finish it and confirm extension in a modal.
- Restore configured resources through DM short/long-rest scene transitions.

#### Personal arena

- Show the complete initiative order, including every player and enemy.
- Mark the current turn and distinguish player/enemy cards.
- Allow only living enemies to be selected as attack targets.
- Keep damage entry manual. Battle Forge does not roll weapon dice, calculate critical hits, or enforce a fixed attack count.
- Provide main attack and additional-hit presentation tabs so the table can resolve class features and improvised actions itself.
- Keep personal status effects, active resources, knockout state, and death-save progress visible on both player tabs.

### Shared display

- Show immersive enemy cards with HP, AC, initiative, resistances, attacks, abilities, and active effects.
- Highlight the active combatant and current round.
- Show party alerts for player effects, knockout, death saves, and death.
- Apply distinct visual treatments for poison, fire, ice, fear, bleeding, and other effects.
- Switch instantly to a full-screen story slide and back to combat.
- Show preparation, initiative, and battle-ended splash screens.

### Persistence and synchronization

| Data | Storage/synchronization |
| --- | --- |
| Battle room, initiative, HP, effects | Firebase Realtime Database, live across clients |
| Character sheets, inventory, spells, slots, resources | Firebase Realtime Database |
| Creature, scene, item, spell, and enemy-action libraries | Firebase Realtime Database under `dm-library` |
| Story script sections | Firebase Realtime Database under the main story |
| Story image deck | Browser memory and same-device `BroadcastChannel` |
| Last successful player name | Browser `localStorage` |

Firebase Storage is not used.

### Typical table workflow

1. Open `/dm` on the DM computer and `/display` in a second tab/window on the shared monitor.
2. Open `/player` on each phone. Log in or import the LSS JSON once.
3. Prepare creature templates and scene presets, or translate/import content from Open5E.
4. Load story images in the DM story workspace if the session uses illustrations.
5. Add a scene to battle and synchronize players from the database.
6. Roll/edit initiative, confirm it, and run turns from the combat workspace.
7. Apply HP changes, effects, death saves, rewards, spells, and resources as needed.
8. Finish the scene with the appropriate rest mode and launch the next preset.

### Current alpha scope

- One fixed Firebase room: `main-room`.
- Designed for a private/local game; authentication, hardened Firebase rules, and simultaneous independent campaigns are outside the current scope.
- Automatic spell slots support single-class progression only.
- LSS remote references are not resolved through private LSS APIs.
- Dice, hit checks, critical hits, class restrictions, and exact D&D rulings remain table decisions.
- Story image decks are session-local and are not uploaded to Firebase.

### Technology

- Angular 20, standalone components, signals, and RxJS
- TypeScript with strict Angular templates
- Firebase Realtime Database
- SCSS design tokens and responsive/iOS-specific UI
- Installable PWA with service worker, favicon, Apple Touch Icon, and maskable icons
- Vitest, Angular TestBed, jsdom, and Firebase Local Emulator Suite

### Requirements and local start

- Node.js 24 (the CI version)
- npm
- Java 21 only for Firebase Emulator integration tests

Install exact dependencies:

```bash
npm ci
```

Provide matching Firebase configuration objects in:

```text
src/environments/environment.ts
src/environments/environment.prod.ts
```

The files are ignored by Git and generated in CI. Both Angular development and production configurations currently replace `environment.ts` with `environment.prod.ts`, so `npm start` connects to the production Firebase project configured in `environment.prod.ts`. Local manual actions can therefore change shared production data.

Start the development server:

```bash
npm start
```

Open:

- <http://localhost:4200/dm>
- <http://localhost:4200/display>
- <http://localhost:4200/player>

The service worker is disabled in development mode. Test installation/offline PWA behavior with a production build served over HTTPS or localhost.

### Commands

| Command | Purpose |
| --- | --- |
| `npm start` | Start the Angular development server |
| `npm test` | Run Vitest in watch mode |
| `npm run test:run` | Run all unit/component tests once |
| `npm run test:ui` | Open the Vitest UI |
| `npm run test:coverage` | Generate coverage in `coverage/` |
| `npm run test:ci` | Run coverage with the 70% global thresholds used by CI |
| `npm run test:firebase` | Run Firebase SDK/rules tests against the local RTDB emulator |
| `npm run test:all` | Run coverage tests and Firebase emulator tests |
| `npm run emulator:firebase` | Keep the RTDB emulator running for manual work |
| `npm run build` | Build the production application |
| `npm run build:prod` | Build for GitHub Pages with `/battle-forge/` as base href |

### CI/CD

`.github/workflows/deploy.yaml` runs on pull requests and pushes to `master`:

1. installs dependencies with `npm ci`;
2. generates temporary environment files;
3. runs coverage tests;
4. runs Firebase emulator integration tests;
5. builds the GitHub Pages bundle;
6. creates the SPA `404.html` fallback;
7. deploys only for a push to `master`.

The browser output is `dist/battle-forge/browser`.

### Architecture

```text
src/app/
├── core/
│   ├── constants/   # closed value sets, Firebase paths, progression tables
│   ├── models/      # persisted and domain data shapes
│   ├── services/    # combat, characters, libraries, Firebase, story, Open5E
│   └── utils/       # normalization, initiative, JSON, Markdown, slot progression
├── features/
│   ├── dm-control/  # DM shell and scene/item/Open5E/story workspaces
│   ├── player/      # player login, sheet, resources, spells, and arena
│   └── display/     # public battle/story presentation
└── shared/ui/       # HP bar, enemy icon, effects, and life-state components
```

`FirebaseService` is the only Firebase SDK boundary. Feature components consume signal-backed domain services and do not call the SDK directly.

### Disclaimer

Battle Forge is an unofficial fan-made tool and is not affiliated with or endorsed by Wizards of the Coast. No software license has been selected yet; the absence of a `LICENSE` file means the repository is not currently licensed for redistribution.

---

<a id="russian"></a>

## Русский

### О проекте

Battle Forge — локально ориентированный помощник для проведения D&D-сессий с синхронизацией в реальном времени. Он объединяет широкую DM-панель, мобильный лист игрока, общий экран боя, библиотеки контента и режим показа сюжетных иллюстраций.

Это alpha-версия для домашних игр с друзьями. Приложение не пытается полностью заменить правила: игроки сами бросают кости и считают итоговый урон, а Battle Forge хранит общее состояние, порядок ходов, HP, ресурсы, эффекты и презентацию.

### Экраны

| Маршрут | Назначение |
| --- | --- |
| `/dm` | Панель мастера для подготовки, боя, наград, библиотек и истории |
| `/player` | Мобильный лист героя и личная арена игрока |
| `/display` | Общий полноэкранный режим боя или сюжетной иллюстрации |

Корневой маршрут перенаправляет на `/player`.

### Панель мастера

#### 1. Сцены и существа

- Многоразовые шаблоны существ с HP, КД, типом, сопротивлениями, стартовыми состояниями, атаками, бонусами, формулами урона и способностями.
- Добавление сохранённого оружия или атаки в карточку моба.
- Редактирование и удаление существ без повторного заполнения перед каждым боем.
- Сборка именованных сцен: например, лесная засада или драка в таверне.
- Любое количество копий существа в сцене; в бой они попадают отдельными участниками.
- Редактирование сохранённой сцены и добавление новых существ.
- Запуск одного существа или всего набора одной кнопкой.

#### 2. Бой

- Автоматическая синхронизация сохранённых игроков с боевой комнатой.
- Бросок, ручное редактирование и подтверждение инициативы.
- Общий список игроков и врагов с ручной перестановкой и выбором текущего хода.
- Надёжная обработка начала/конца хода, переход раундов и пропуск мёртвых участников.
- Ручной урон, лечение, временные HP, массовый урон врагам и применение к нескольким выбранным целям.
- Ограничение лечения максимумом HP.
- Нокаут, стабилизация, смерть, спасброски от смерти, натуральные 1/20, воскрешение и возврат в бой.
- Отмена последнего поддерживаемого изменения HP и журнал действий.
- Завершение боя, полный сброс комнаты или корректный переход к следующей сцене с сохранением игроков.
- Переход без отдыха, с коротким или долгим отдыхом. Отдых восстанавливает настроенные ячейки и ресурсы.

#### Статус-эффекты и периодический урон

- Эффекты назначаются как игрокам, так и мобам.
- Встроены отравление, горение, заморозка, страх, кровотечение, оглушение, опутывание, благословение, сбивание с ног, ослепление, паралич, невидимость, очарование, захват, бессознательность, истощение, недееспособность, глухота и окаменение.
- Настраиваются урон за срабатывание, число срабатываний, начало/конец хода, источник, концентрация, спасбросок, СЛ и заметка ДМа.
- Значение `0` оставляет эффект активным до ручного снятия.
- ДОТ обрабатывается внутри перехода хода, а изменение HP игрока сохраняется.
- Эффекты синхронно отображаются на `/player` и `/display` с отдельными стилями и анимациями.

#### 3. Игроки и награды

- Личная библиотека предметов в Firebase: название, иконка, редкость, описание, формула, количество, стаки и расходуемость.
- Быстрая выдача сохранённого предмета любому игроку и отдельная форма разовой выдачи.
- Выдача сохранённых или вручную созданных заклинаний.
- Редактор ячеек заклинаний 1–9 уровня с восстановлением после долгого или короткого отдыха.
- Создание, редактирование, заполнение и удаление ресурсов: Ярость, Наложение рук, Очки фокусировки, Божественный канал и любые пользовательские счётчики.
- Быстрые шаблоны ресурсов без жёсткой автоматизации классовых правил.
- Собственные иконки и описания, конечные или бесконечные ресурсы, фиксированный или произвольный расход, ручное/короткое/долгое восстановление и частичное восстановление после короткого отдыха.
- Привязка бесплатного применения заклинания без ячейки.
- Активируемый эффект ресурса: до ручного завершения, конца следующего хода или заданного числа раундов.

#### 4. Переводы Open5E

- Поиск заклинаний, оружия и существ SRD 2014/2024 через Open5E.
- Две колонки: английский оригинал и редактируемый перевод.
- Вставка перевода из LSS, правка правил и однократное сохранение в личную Firebase-библиотеку.
- Сохранение и немедленная выдача заклинания игроку.
- Сохранение оружия/атак для конструктора мобов.
- Сохранение переведённого существа как готового шаблона сцены.
- Повторное использование сохранённых данных без запроса к Open5E.

Для поиска Open5E нужен интернет. Сохранённые библиотеки работают без повторного обращения к API.

#### 5. История и суфлёр

- Локальная загрузка JPG, PNG, WebP и других форматов, поддерживаемых браузером.
- Перестановка слайдов кнопками или drag-and-drop, выбор активного слайда и удаление.
- Переключение `/display` между боем и историей из постоянной панели мастера.
- Переключение слайдов без выхода из другой рабочей зоны DM.
- Полное размещение горизонтальных и вертикальных изображений на Full HD/2K без обрезки; свободное место заполняется размытым фоном.
- Картинки не отправляются в Firebase Storage.
- Синхронизация колоды и текущего слайда между вкладками DM/display через `BroadcastChannel`.
- Сюжетный текст связывается с именем картинки без расширения: `1.png` → раздел `1`.
- Безопасный Markdown: заголовки, абзацы, жирный, курсив, код, цитаты, списки и разделители. Сырой HTML экранируется.
- После сохранения редактор скрывается и остаётся отрендеренный суфлёр; кнопка **Редактировать** возвращает форму.

Изображения живут в памяти браузера и после полной перезагрузки загружаются заново. Текст сюжета сохраняется в Firebase. Колода предназначена для вкладок одного браузера/устройства и не передаётся через Firebase на другой компьютер.

### Экран игрока

#### Вход и импорт героя

- Вход по точному имени сохранённого персонажа.
- Сохранение последнего успешного имени в `localStorage` и кнопка **Войти как …** после перезапуска PWA.
- Ручной вход другим героем остаётся доступным; следующий успешный вход заменяет сохранённое имя.
- Если Safari или приватный режим запрещает localStorage, обычный вход продолжает работать.
- Загрузка JSON из Long Story Short, если персонажа ещё нет в базе.
- Исправление распространённых лишних запятых и нормализация отсутствующих/старых полей перед записью в Firebase.
- Импорт характеристик, HP, КД, скорости, оружия, способностей, инвентаря, встроенных заклинаний, сопротивлений, расы, класса и уровня.

Battle Forge не обращается к закрытым авторизованным endpoint LSS для раскрытия удалённых ID заклинаний. Недостающие заклинания добавляются через библиотеку DM/Open5E.

#### Лист персонажа

- Русские сокращения характеристик и модификаторы, HP/максимум, временные HP, КД, скорость и сопротивления.
- Формулы оружия с русскими обозначениями характеристик, например `1d8 + СИЛ`.
- Инвентарь с количеством, редкостью, формулой, изучением и использованием расходников.
- Раскрываемые способности и компактные описания заклинаний для телефона.
- Выделение обозначений костей в уроне и тексте заклинаний.

#### Заклинания и ячейки

- Заговоры используются бесконечно и не расходуют ячейку.
- Заклинание уровня 1+ тратит общую доступную ячейку своего или большего уровня.
- Игрок выбирает подходящий уровень ячейки.
- Модалка подтверждает использованное заклинание, уровень ячейки или бесплатный ресурс.
- Автоматические ячейки по правилам D&D 2024 для поддерживаемых одиночных классов:
  - полные заклинатели: Бард, Жрец, Друид, Чародей, Волшебник;
  - полу-заклинатели: Паладин, Следопыт;
  - магия договора: Колдун с восстановлением после короткого отдыха.
- ДМ всегда может вручную исправить остаток и максимум.

Расчёт мультикласса в текущей alpha намеренно не автоматизирован.

#### Ресурсы персонажа

- Иконка и описание, выбранные ДМом, отображаются на карточке и в модалках игрока.
- Исчерпанный конечный ресурс блокируется и визуально приглушается.
- Поддерживаются бесконечные способности и произвольные пулы вроде Наложения рук.
- После использования появляется подтверждение.
- Активированный ресурс отображается как боевой эффект; игрок может продлить или завершить его и получает отдельное подтверждение продления.
- Короткий/долгий отдых через переход сцены восстанавливает ресурс по настройкам ДМа.

#### Личная арена

- Полная очередь инициативы со всеми игроками и мобами.
- Выделение текущего хода и различие типов участников.
- Целью атаки может быть только живой враг.
- Урон вводится вручную: приложение не бросает кости оружия, не считает крит и не ограничивает число атак.
- Вкладки основной и дополнительной атаки позволяют самостоятельно учитывать классовые и импровизированные действия.
- Личные статусы, активные ресурсы, нокаут и спасброски видны на обеих вкладках.

### Общий экран

- Иммерсивные карточки врагов с HP, КД, инициативой, сопротивлениями, атаками, способностями и эффектами.
- Выделение текущего хода и номера раунда.
- Уведомления о статусах игроков, нокауте, спасбросках и смерти.
- Отдельные визуальные эффекты для яда, огня, льда, страха, кровотечения и других состояний.
- Мгновенное переключение на полноэкранную сюжетную картинку и обратно.
- Заставки подготовки, инициативы и завершённого боя.

### Где хранятся данные

| Данные | Хранилище/синхронизация |
| --- | --- |
| Бой, инициатива, HP и эффекты | Firebase Realtime Database, realtime между клиентами |
| Листы, инвентарь, заклинания, ячейки и ресурсы | Firebase Realtime Database |
| Существа, сцены, предметы, заклинания и атаки мобов | Firebase Realtime Database, ветка `dm-library` |
| Текст основной истории | Firebase Realtime Database |
| Колода сюжетных картинок | Память браузера и `BroadcastChannel` одного устройства |
| Имя последнего игрока | `localStorage` браузера |

Firebase Storage не используется.

### Быстрый сценарий игры

1. Откройте `/dm` на компьютере мастера и `/display` в отдельной вкладке/окне общего монитора.
2. Игроки открывают `/player` на телефонах и один раз входят или загружают LSS JSON.
3. Подготовьте существ и набор сцены либо импортируйте/переведите данные из Open5E.
4. При необходимости загрузите сюжетные картинки в панели «История».
5. Добавьте сцену в бой и синхронизируйте игроков из базы.
6. Бросьте/исправьте инициативу, подтвердите порядок и ведите ходы.
7. Назначайте HP, эффекты, спасброски, награды, заклинания и ресурсы.
8. Завершите сцену с нужным режимом отдыха и запустите следующий набор.

### Ограничения alpha-версии

- Одна фиксированная Firebase-комната `main-room`.
- Приложение рассчитано на личную игру: авторизация, усиленные Firebase rules и несколько независимых кампаний пока вне текущего scope.
- Автоматические ячейки рассчитаны только для одного класса.
- Закрытые ссылки/ID LSS не раскрываются через приватный API.
- Броски, попадания, криты, классовые ограничения и спорные правила остаются решением стола.
- Сюжетные картинки не сохраняются в облако и после перезапуска загружаются снова.

### Технологии

- Angular 20, standalone-компоненты, signals и RxJS
- TypeScript и строгие Angular-шаблоны
- Firebase Realtime Database
- SCSS-токены, адаптивная и iOS-ориентированная вёрстка
- Устанавливаемая PWA: service worker, favicon, Apple Touch Icon и maskable-иконки
- Vitest, Angular TestBed, jsdom и Firebase Local Emulator Suite

### Требования и локальный запуск

- Node.js 24 — версия CI
- npm
- Java 21 — только для интеграционных тестов Firebase Emulator

Установите зависимости:

```bash
npm ci
```

Добавьте одинаковую по структуре Firebase-конфигурацию в:

```text
src/environments/environment.ts
src/environments/environment.prod.ts
```

Файлы игнорируются Git и генерируются в CI. Сейчас и development-, и production-конфигурация Angular подменяют `environment.ts` на `environment.prod.ts`, поэтому `npm start` подключается к Firebase-проекту из `environment.prod.ts`. Локальные действия могут изменять общие production-данные.

Запустите приложение:

```bash
npm start
```

Маршруты:

- <http://localhost:4200/dm>
- <http://localhost:4200/display>
- <http://localhost:4200/player>

В development service worker отключён. Установку и offline-поведение PWA проверяйте production-сборкой через HTTPS или localhost.

### Команды

| Команда | Назначение |
| --- | --- |
| `npm start` | Angular dev-сервер |
| `npm test` | Vitest в watch-режиме |
| `npm run test:run` | Однократный запуск unit/component-тестов |
| `npm run test:ui` | Vitest UI |
| `npm run test:coverage` | Coverage-отчёт в `coverage/` |
| `npm run test:ci` | Coverage с глобальными порогами 70% для CI |
| `npm run test:firebase` | Firebase SDK/rules-тесты с локальным RTDB Emulator |
| `npm run test:all` | Coverage и Firebase-интеграционные тесты |
| `npm run emulator:firebase` | Постоянный запуск RTDB Emulator |
| `npm run build` | Production-сборка |
| `npm run build:prod` | Сборка GitHub Pages с base href `/battle-forge/` |

### CI/CD

`.github/workflows/deploy.yaml` запускается для pull request и push в `master`:

1. `npm ci`;
2. создание временных environment-файлов;
3. unit/component-тесты с coverage;
4. Firebase Emulator integration-тесты;
5. GitHub Pages production-сборка;
6. создание SPA fallback `404.html`;
7. деплой только при push в `master`.

Готовый browser bundle находится в `dist/battle-forge/browser`.

### Архитектура

```text
src/app/
├── core/
│   ├── constants/   # наборы значений, Firebase paths, таблицы прогрессии
│   ├── models/      # доменные и сохраняемые структуры
│   ├── services/    # бой, герои, библиотеки, Firebase, история, Open5E
│   └── utils/       # нормализация, инициатива, JSON, Markdown, ячейки
├── features/
│   ├── dm-control/  # DM shell и сцены/предметы/Open5E/история
│   ├── player/      # вход, лист, ресурсы, заклинания и арена
│   └── display/     # общий экран боя/истории
└── shared/ui/       # HP bar, иконка врага, эффекты и состояния жизни
```

`FirebaseService` — единственная граница Firebase SDK. Компоненты работают с signal-состоянием доменных сервисов и не обращаются к SDK напрямую.

### Дисклеймер

Battle Forge — неофициальный фанатский инструмент, не связанный с Wizards of the Coast и не одобренный компанией. Лицензия пока не выбрана; без файла `LICENSE` репозиторий не лицензирован для распространения.
