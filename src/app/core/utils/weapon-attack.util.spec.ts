import { describe, expect, it } from 'vitest';
import { CharacterStats, CharacterWeapon } from '../models/character.model';
import {
  formatSignedModifier,
  getCharacterProficiencyBonus,
  getWeaponAttackBonus,
} from './weapon-attack.util';

const stats: CharacterStats = {
  str: 16,
  dex: 14,
  con: 12,
  int: 10,
  wis: 8,
  cha: 18,
};

const weapon = (damage: string): CharacterWeapon => ({
  name: 'Weapon',
  damage,
  damageType: 'bludgeoning',
});

describe('weapon attack helpers', () => {
  it('combines the formula ability modifier with proficiency', () => {
    expect(getWeaponAttackBonus(weapon('1d8 + \u0421\u0418\u041b'), stats, 1)).toBe(5);
    expect(getWeaponAttackBonus(weapon('1d4 + DEX'), stats, 5)).toBe(5);
    expect(getWeaponAttackBonus(weapon('1d6 + \u0425\u0410\u0420'), stats, 9)).toBe(8);
  });

  it('returns no bonus when the weapon formula has no ability marker', () => {
    expect(getWeaponAttackBonus(weapon('1d10'), stats, 1)).toBeNull();
  });

  it('clamps proficiency progression and formats signed values', () => {
    expect(getCharacterProficiencyBonus(0)).toBe(2);
    expect(getCharacterProficiencyBonus(20)).toBe(6);
    expect(getCharacterProficiencyBonus(99)).toBe(6);
    expect(formatSignedModifier(4)).toBe('+4');
    expect(formatSignedModifier(-1)).toBe('-1');
  });
});
