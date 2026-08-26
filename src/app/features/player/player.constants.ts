export const CHARACTER_STATS = [
  { key: 'str', label: 'СИЛ', title: 'Сила' },
  { key: 'dex', label: 'ЛОВ', title: 'Ловкость' },
  { key: 'con', label: 'ТЕЛ', title: 'Телосложение' },
  { key: 'int', label: 'ИНТ', title: 'Интеллект' },
  { key: 'wis', label: 'МДР', title: 'Мудрость' },
  { key: 'cha', label: 'ХАР', title: 'Харизма' },
] as const;

export const DICE_NOTATION_PATTERN = /(\d+\s*[dдк]\s*\d+(?:\s*[+\-−]\s*\d+)?)/giu;
export const EXACT_DICE_NOTATION_PATTERN = /^\d+\s*[dдк]\s*\d+(?:\s*[+\-−]\s*\d+)?$/iu;
export const LAST_PLAYER_NAME_STORAGE_KEY = 'battle-forge:last-player-name';
