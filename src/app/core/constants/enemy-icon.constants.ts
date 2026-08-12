/** Emoji glyph shown for a given enemy creature subtype. */
export const ENEMY_TYPE_ICON = {
  dragon: '🐉',
  goblin: '👹',
  orc: '🗡️',
  undead: '💀',
  beast: '🦁',
} as const;

export const DEFAULT_ENEMY_ICON = '👹';

export type EnemyTypeIconKey = keyof typeof ENEMY_TYPE_ICON;
