import {
  FULL_CASTER_CLASS_ALIASES,
  FULL_CASTER_SLOTS_2024,
  HALF_CASTER_CLASS_ALIASES,
  PACT_CASTER_CLASS_ALIASES,
  PACT_MAGIC_SLOTS_2024,
} from '../constants/spell-slot-progression.constants';
import { SpellSlotPool } from '../models/character.model';

export function getAutomaticSpellSlots(className: string, classLevel: number): SpellSlotPool[] {
  const normalizedClass = normalizeClassName(className);
  const level = Math.max(1, Math.min(20, Math.floor(classLevel || 1)));

  if (matchesSingleClass(normalizedClass, PACT_CASTER_CLASS_ALIASES)) {
    const pact = PACT_MAGIC_SLOTS_2024[level];
    return pact.count > 0
      ? [{ level: pact.level, current: pact.count, max: pact.count, recovery: 'short-rest' }]
      : [];
  }

  const casterLevel = matchesSingleClass(normalizedClass, FULL_CASTER_CLASS_ALIASES)
    ? level
    : matchesSingleClass(normalizedClass, HALF_CASTER_CLASS_ALIASES)
      ? Math.ceil(level / 2)
      : 0;

  return casterLevel > 0
    ? FULL_CASTER_SLOTS_2024[casterLevel].map((maximum, index) => ({
        level: index + 1,
        current: maximum,
        max: maximum,
      }))
    : [];
}

function normalizeClassName(value: string): string {
  return value.trim().toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ');
}

function matchesSingleClass(normalized: string, aliases: readonly string[]): boolean {
  return aliases.some(
    (alias) =>
      normalized === alias ||
      new RegExp(`^${alias}\\s+\\d+$`).test(normalized) ||
      normalized.startsWith(`${alias} (`) ||
      normalized.startsWith(`${alias}:`) ||
      normalized.startsWith(`${alias} —`) ||
      normalized.startsWith(`${alias} -`),
  );
}
