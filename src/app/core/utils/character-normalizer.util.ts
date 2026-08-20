import {
  CharacterResource,
  CharacterWeapon,
  ParsedCharacter,
  ResourceRecovery,
  SpellSlotPool,
} from '../models/character.model';
import { formatWeaponDamageFormula } from './weapon-formula.util';
import { getAutomaticSpellSlots } from './spell-slot-progression.util';

const RECOVERY_TYPES: readonly ResourceRecovery[] = ['short-rest', 'long-rest', 'manual'];

function finiteInteger(value: unknown, fallback: number, minimum = 0): number {
  const number = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(number) ? Math.max(minimum, Math.floor(number)) : fallback;
}

export function normalizeSpellSlots(value: unknown): SpellSlotPool[] {
  if (!Array.isArray(value)) return [];
  const byLevel = new Map<number, SpellSlotPool>();
  for (const raw of value) {
    if (!raw || typeof raw !== 'object') continue;
    const candidate = raw as Partial<SpellSlotPool>;
    const level = finiteInteger(candidate.level, 0);
    if (level < 1 || level > 9) continue;
    const max = finiteInteger(candidate.max, 0);
    byLevel.set(level, {
      level,
      max,
      current: Math.min(max, finiteInteger(candidate.current, max)),
      ...(candidate.recovery === 'short-rest' ? { recovery: 'short-rest' as const } : {}),
    });
  }
  return [...byLevel.values()].sort((a, b) => a.level - b.level);
}

export function normalizeCharacterResources(value: unknown): CharacterResource[] {
  if (!Array.isArray(value)) return [];
  const ids = new Set<string>();
  const result: CharacterResource[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== 'object') continue;
    const candidate = raw as Partial<CharacterResource>;
    const name = typeof candidate.name === 'string' ? candidate.name.trim() : '';
    if (!name) continue;
    const description = typeof candidate.description === 'string'
      ? candidate.description.trim()
      : '';
    const idValue = typeof candidate.id === 'string' ? candidate.id.trim() : '';
    const id = idValue && !ids.has(idValue) ? idValue : `resource_legacy_${result.length}`;
    ids.add(id);
    const isUnlimited = candidate.isUnlimited === true;
    const max = isUnlimited ? 0 : finiteInteger(candidate.max, 0);
    const recovery = isUnlimited
      ? ('manual' as const)
      : RECOVERY_TYPES.includes(candidate.recovery as ResourceRecovery)
      ? (candidate.recovery as ResourceRecovery)
      : 'manual';
    result.push({
      id,
      name,
      ...(description ? { description } : {}),
      ...(isUnlimited ? { isUnlimited: true } : {}),
      max,
      current: isUnlimited ? 0 : Math.min(max, finiteInteger(candidate.current, max)),
      recovery,
    });
  }
  return result;
}

export function normalizeCharacterWeapons(value: unknown): CharacterWeapon[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((raw) => {
    if (!raw || typeof raw !== 'object') return [];
    const candidate = raw as Record<string, unknown>;
    const name = typeof candidate['name'] === 'string' ? candidate['name'].trim() : '';
    if (!name) return [];
    const damageType = typeof candidate['damageType'] === 'string'
      ? candidate['damageType'].trim()
      : '';
    return [{
      name,
      damage: formatWeaponDamageFormula(candidate['damage'], candidate['ability'] ?? 'str'),
      damageType: damageType || 'дробящий',
    }];
  });
}

export function normalizeCharacter(character: ParsedCharacter): ParsedCharacter {
  const maxHp = Math.max(1, finiteInteger(character.maxHp, 10, 1));
  const spellSlots = character.spellSlots === undefined
    ? getAutomaticSpellSlots(character.class, character.level)
    : normalizeSpellSlots(character.spellSlots);
  return {
    ...character,
    level: Math.max(1, finiteInteger(character.level, 1, 1)),
    maxHp,
    currentHp: Math.min(maxHp, finiteInteger(character.currentHp, maxHp)),
    temporaryHp: finiteInteger(character.temporaryHp, 0),
    weapons: normalizeCharacterWeapons(character.weapons),
    abilities: Array.isArray(character.abilities) ? character.abilities : [],
    resistances: Array.isArray(character.resistances) ? character.resistances : [],
    inventory: Array.isArray(character.inventory) ? character.inventory : [],
    spells: Array.isArray(character.spells) ? character.spells : [],
    spellSlots,
    resources: normalizeCharacterResources(character.resources),
  };
}
