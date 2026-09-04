import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const translations = {
  en: {
    battleControls: {
      confirmFinish: {
        longRest: 'Finish the scene, remove enemies, and fully restore living players?',
        shortRest: 'Finish the scene with a short rest? HP will not change.',
        keepHp: 'Finish the scene, remove enemies, and keep the players’ current HP?',
      },
      confirmReset: 'Are you sure you want to reset the entire battle?',
      feedback: {
        playersUpdated: 'Player list updated: {{ count }}.',
        noPlayers: 'There are no saved players in the database yet.',
      },
      error: { loadPlayers: 'Could not load players from the database. Try refreshing the list.' },
    },
    roster: {
      lifeStatus: { downed: 'Unconscious', stable: 'Stable', dead: 'Dead', alive: 'Active' },
    },
    itemLibrary: {
      confirmDelete: 'Delete the “{{ name }}” template?',
      feedback: {
        updated: 'Item template updated.',
        saved: 'Item saved to the library.',
        deleted: 'Item template deleted.',
        given: '{{ item }} was given to {{ player }}.',
      },
      error: {
        save: 'Could not save the item. The form data was preserved.',
        delete: 'Could not delete the item.',
        give: 'Could not give the item. Your selection was preserved.',
      },
    },
    story: {
      feedback: {
        imagesAdded: 'Images added: {{ count }}',
        noImages: 'No supported images were found.',
        saved: 'Story “{{ section }}” saved.',
      },
      error: { save: 'Could not save the story. The text remains in the editor—try again.' },
    },
    statusEffects: {
      error: {
        alreadyApplied: 'The effect is already applied or the combatant is no longer available.',
        apply: 'Could not apply the effect.',
        alreadyRemoved: 'The effect is already removed or the combatant is no longer available.',
        remove: 'Could not remove the effect.',
      },
    },
    resourceManager: {
      confirmDelete: 'Delete the “{{ name }}” resource from this hero?',
      feedback: {
        slotsSaved: 'Spell slots saved.',
        resourceSaved: 'Resource saved.',
        resourceDeleted: 'Resource deleted.',
      },
      error: { save: 'Could not save the resources. The form data was preserved.' },
      presetData: {
        rage: {
          name: 'Rage',
          description: 'Resistance to bludgeoning, piercing, and slashing damage; +2 damage with Strength-based attacks; advantage on Strength checks and saving throws. You cannot cast spells or maintain concentration.',
        },
        'lay-on-hands': {
          name: 'Lay on Hands',
          description: 'Spend any number of points to restore the same amount of HP. You may spend 5 points to remove the Poisoned condition without restoring HP.',
        },
        'channel-divinity': {
          name: 'Channel Divinity',
          description: 'Choose an effect available to the character’s class or subclass.',
        },
        'focus-points': { name: 'Focus Points', description: 'Spent on monk abilities.' },
        'heroic-inspiration': {
          name: 'Heroic Inspiration',
          description: 'Can be spent to reroll any die immediately after the roll.',
        },
        'free-spell': {
          name: 'Free Spell Use',
          description: 'One use of the linked spell without spending a spell slot.',
        },
      },
    },
    sceneLibrary: {
      confirmDeleteCreature: 'Delete the “{{ name }}” template?',
      confirmDeleteScene: 'Delete the “{{ name }}” scene preset?',
      deletedTemplate: 'Template deleted',
      feedback: {
        creatureUpdated: 'Creature template updated.',
        creatureSaved: 'Creature saved to the library.',
        creatureDeleted: 'Creature template deleted.',
        creatureAdded: '{{ name }} was added to the current battle.',
        sceneUpdated: 'Scene preset updated.',
        sceneSaved: 'Scene preset saved.',
        sceneAdded: 'Scene “{{ name }}” added: {{ count }} creatures.',
        sceneDeleted: 'Scene preset deleted.',
      },
      error: {
        saveCreature: 'Could not save the creature. The form data was preserved.',
        creatureInUse: 'The creature is used by a saved scene. Remove it from the preset first.',
        deleteCreature: 'Could not delete the creature.',
        addCreature: 'Could not add the creature to the battle.',
        saveScene: 'Could not save the preset. The form data was preserved.',
        missingCreatures: 'One or more creature templates are missing from this preset.',
        addScene: 'Could not add the scene to the battle.',
        deleteScene: 'Could not delete the scene preset.',
      },
    },
  },
  ru: {
    battleControls: {
      confirmFinish: {
        longRest: 'Завершить сцену, убрать врагов и полностью восстановить живых игроков?',
        shortRest: 'Завершить сцену с коротким отдыхом? HP не изменится.',
        keepHp: 'Завершить сцену, убрать врагов и сохранить текущее HP игроков?',
      },
      confirmReset: 'Вы уверены, что хотите полностью сбросить бой?',
      feedback: {
        playersUpdated: 'Список игроков обновлён: {{ count }}.',
        noPlayers: 'В базе пока нет сохранённых игроков.',
      },
      error: { loadPlayers: 'Не удалось загрузить игроков из базы. Попробуйте обновить список.' },
    },
    roster: {
      lifeStatus: { downed: 'Без сознания', stable: 'Стабилен', dead: 'Погиб', alive: 'В строю' },
    },
    itemLibrary: {
      confirmDelete: 'Удалить шаблон «{{ name }}»?',
      feedback: {
        updated: 'Шаблон предмета обновлён.',
        saved: 'Предмет сохранён в библиотеку.',
        deleted: 'Шаблон предмета удалён.',
        given: '{{ item }} выдан персонажу {{ player }}.',
      },
      error: {
        save: 'Не удалось сохранить предмет. Данные формы не потеряны.',
        delete: 'Не удалось удалить предмет.',
        give: 'Не удалось выдать предмет. Выбор сохранён.',
      },
    },
    story: {
      feedback: {
        imagesAdded: 'Добавлено изображений: {{ count }}',
        noImages: 'Подходящие изображения не найдены.',
        saved: 'Сюжет «{{ section }}» сохранён.',
      },
      error: { save: 'Не удалось сохранить сюжет. Текст оставлен в редакторе — попробуйте ещё раз.' },
    },
    statusEffects: {
      error: {
        alreadyApplied: 'Эффект уже назначен или участник больше недоступен.',
        apply: 'Не удалось назначить эффект.',
        alreadyRemoved: 'Эффект уже снят или участник больше недоступен.',
        remove: 'Не удалось снять эффект.',
      },
    },
    resourceManager: {
      confirmDelete: 'Удалить ресурс «{{ name }}» у героя?',
      feedback: {
        slotsSaved: 'Ячейки заклинаний сохранены.',
        resourceSaved: 'Ресурс сохранён.',
        resourceDeleted: 'Ресурс удалён.',
      },
      error: { save: 'Не удалось сохранить ресурсы. Данные формы сохранены.' },
      presetData: {
        rage: {
          name: 'Ярость',
          description: 'Сопротивление дробящему, колющему и рубящему урону; +2 к урону атакой через СИЛ; преимущество на проверки и спасброски СИЛ. Нельзя колдовать и поддерживать концентрацию.',
        },
        'lay-on-hands': {
          name: 'Наложение рук',
          description: 'Потратьте выбранное количество очков и восстановите столько же HP. За 5 очков можно снять состояние «Отравлен», не восстанавливая HP.',
        },
        'channel-divinity': {
          name: 'Божественный канал',
          description: 'Выберите доступный классу или подклассу эффект Божественного канала.',
        },
        'focus-points': { name: 'Очки фокуса', description: 'Расходуются на способности монаха.' },
        'heroic-inspiration': {
          name: 'Вдохновение героя',
          description: 'Можно потратить, чтобы перебросить любую кость сразу после броска.',
        },
        'free-spell': {
          name: 'Бесплатное применение заклинания',
          description: 'Одно применение связанного заклинания без траты ячейки.',
        },
      },
    },
    sceneLibrary: {
      confirmDeleteCreature: 'Удалить шаблон «{{ name }}»?',
      confirmDeleteScene: 'Удалить набор «{{ name }}»?',
      deletedTemplate: 'Шаблон удалён',
      feedback: {
        creatureUpdated: 'Шаблон существа обновлён.',
        creatureSaved: 'Существо сохранено в библиотеку.',
        creatureDeleted: 'Шаблон существа удалён.',
        creatureAdded: '{{ name }} добавлен в текущий бой.',
        sceneUpdated: 'Набор сцены обновлён.',
        sceneSaved: 'Набор сцены сохранён.',
        sceneAdded: 'Сцена «{{ name }}» добавлена: {{ count }} существ.',
        sceneDeleted: 'Набор сцены удалён.',
      },
      error: {
        saveCreature: 'Не удалось сохранить существо. Данные формы сохранены.',
        creatureInUse: 'Существо используется в сохранённой сцене. Сначала удалите его из набора.',
        deleteCreature: 'Не удалось удалить существо.',
        addCreature: 'Не удалось добавить существо в бой.',
        saveScene: 'Не удалось сохранить набор. Данные формы сохранены.',
        missingCreatures: 'В наборе отсутствует один или несколько шаблонов существ.',
        addScene: 'Не удалось добавить сцену в бой.',
        deleteScene: 'Не удалось удалить набор сцены.',
      },
    },
  },
};

const deepMerge = (target, source) => {
  for (const [key, value] of Object.entries(source)) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      target[key] ??= {};
      deepMerge(target[key], value);
    } else {
      target[key] = value;
    }
  }
};

const generatedDiffs = [];
const temporaryFiles = [];
for (const language of Object.keys(translations)) {
  const sourcePath = `public/i18n/${language}.json`;
  const temporaryPath = `${sourcePath}.i18n-tmp`;
  const dictionary = JSON.parse(readFileSync(sourcePath, 'utf8'));
  deepMerge(dictionary, translations[language]);
  writeFileSync(temporaryPath, `${JSON.stringify(dictionary, null, 2)}\n`, 'utf8');
  temporaryFiles.push(temporaryPath);
  const diffResult = spawnSync(
    'git',
    ['-c', 'core.autocrlf=false', 'diff', '--no-index', '--', sourcePath, temporaryPath],
    { encoding: 'utf8' },
  );
  if (![0, 1].includes(diffResult.status ?? -1)) throw new Error(diffResult.stderr);
  generatedDiffs.push(diffResult.stdout.replaceAll(`b/${temporaryPath}`, `b/${sourcePath}`));
}

writeFileSync('.codex-generated.patch', generatedDiffs.join(''), 'utf8');
const applyResult = spawnSync(
  'git',
  ['apply', '--recount', '--whitespace=nowarn', '.codex-generated.patch'],
  { encoding: 'utf8' },
);
if (applyResult.status !== 0) throw new Error(applyResult.stderr);
for (const path of temporaryFiles) unlinkSync(path);
unlinkSync('.codex-generated.patch');
