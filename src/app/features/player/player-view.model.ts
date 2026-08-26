import { CharacterWeapon } from '../../core/models/character.model';

export interface SpellDescriptionPart {
  text: string;
  isDice: boolean;
}

export interface SpellUseConfirmation {
  spellName: string;
  isCantrip: boolean;
  slotLevel: number | null;
  resourceName?: string;
}

export interface ResourceUseConfirmation {
  resourceName: string;
  icon: string;
  isUnlimited: boolean;
  remaining: number;
  max: number;
  spent: number;
  activated: boolean;
}

export interface ResourceEffectConfirmation {
  resourceName: string;
  durationLabel: string;
  icon: string;
}

export interface CharacterWeaponView {
  weapon: CharacterWeapon;
  attackBonus: string | null;
}
