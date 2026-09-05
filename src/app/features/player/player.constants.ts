export const CHARACTER_STATS = [
  { key: 'str' },
  { key: 'dex' },
  { key: 'con' },
  { key: 'int' },
  { key: 'wis' },
  { key: 'cha' },
] as const;

export const DICE_NOTATION_PATTERN = /(\d+\s*[dдк]\s*\d+(?:\s*[+\-−]\s*\d+)?)/giu;
export const EXACT_DICE_NOTATION_PATTERN = /^\d+\s*[dдк]\s*\d+(?:\s*[+\-−]\s*\d+)?$/iu;
export const LAST_PLAYER_NAME_STORAGE_KEY = 'battle-forge:last-player-name';
