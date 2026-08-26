import {
  CharacterSkillDefinition,
  CharacterStatKey,
} from '../models/character-skill.model';

export const CHARACTER_STAT_KEYS: readonly CharacterStatKey[] = [
  'str',
  'dex',
  'con',
  'int',
  'wis',
  'cha',
];

export const LSS_SKILL_PROFICIENCY_TARGET_PREFIX = 'prof.skill.';

export const CHARACTER_SKILL_DEFINITIONS: readonly CharacterSkillDefinition[] = [
  { id: 'athletics', name: 'Атлетика', baseStat: 'str' },
  { id: 'acrobatics', name: 'Акробатика', baseStat: 'dex' },
  { id: 'sleight of hand', name: 'Ловкость рук', baseStat: 'dex' },
  { id: 'stealth', name: 'Скрытность', baseStat: 'dex' },
  { id: 'arcana', name: 'Магия', baseStat: 'int' },
  { id: 'history', name: 'История', baseStat: 'int' },
  { id: 'investigation', name: 'Анализ', baseStat: 'int' },
  { id: 'nature', name: 'Природа', baseStat: 'int' },
  { id: 'religion', name: 'Религия', baseStat: 'int' },
  { id: 'animal handling', name: 'Уход за животными', baseStat: 'wis' },
  { id: 'insight', name: 'Проницательность', baseStat: 'wis' },
  { id: 'medicine', name: 'Медицина', baseStat: 'wis' },
  { id: 'perception', name: 'Внимательность', baseStat: 'wis' },
  { id: 'survival', name: 'Выживание', baseStat: 'wis' },
  { id: 'deception', name: 'Обман', baseStat: 'cha' },
  { id: 'intimidation', name: 'Запугивание', baseStat: 'cha' },
  { id: 'performance', name: 'Выступление', baseStat: 'cha' },
  { id: 'persuasion', name: 'Убеждение', baseStat: 'cha' },
];
