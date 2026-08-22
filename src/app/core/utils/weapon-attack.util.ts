import { CharacterStats, CharacterWeapon } from '../models/character.model';

type CharacterStatKey = keyof CharacterStats;

const WEAPON_STAT_PATTERNS: ReadonlyArray<{
  key: CharacterStatKey;
  pattern: RegExp;
}> = [
  { key: 'str', pattern: /(?:СИЛ|STR)/iu },
  { key: 'dex', pattern: /(?:ЛОВ|DEX)/iu },
  { key: 'con', pattern: /(?:ТЕЛ|CON)/iu },
  { key: 'int', pattern: /(?:ИНТ|INT)/iu },
  { key: 'wis', pattern: /(?:МДР|WIS)/iu },
  { key: 'cha', pattern: /(?:ХАР|CHA)/iu },
];

/** Returns the standard D&D proficiency bonus for a character level. */
export function getCharacterProficiencyBonus(level: number): number {
  const safeLevel = Number.isFinite(level) ? Math.min(20, Math.max(1, Math.trunc(level))) : 1;
  return 2 + Math.floor((safeLevel - 1) / 4);
}

/** Derives the attack ability from the stored damage formula. */
export function getWeaponAttackBonus(
  weapon: CharacterWeapon,
  stats: CharacterStats,
  level: number,
): number | null {
  const formula = typeof weapon.damage === 'string' ? weapon.damage : '';
  const ability = WEAPON_STAT_PATTERNS.find(({ pattern }) => pattern.test(formula))?.key;
  if (!ability) return null;

  const abilityModifier = Math.floor((stats[ability] - 10) / 2);
  return abilityModifier + getCharacterProficiencyBonus(level);
}

export function formatSignedModifier(value: number): string {
  return value >= 0 ? `+${value}` : `${value}`;
}
