import { SpellData } from './combatant.model';
import { InventoryItem } from './inventory-item.model';
import { CharacterResource } from './character-resource.model';
import { SpellSlotPool } from './spell-slot.model';
import { CharacterSkill } from './character-skill.model';

export interface CharacterStats {
  str: number;
  dex: number;
  con: number;
  int: number;
  wis: number;
  cha: number;
}

export interface CharacterWeapon {
  name: string;
  damage: string;
  damageType: string;
}

export interface CharacterAbility {
  name: string;
  description: string;
  source?: 'resource' | 'feat';
}

/** Character sheet normalized from a raw LSS (Long Story Short) export. */
export interface ParsedCharacter {
  name: string;
  class: string;
  level: number;
  race: string;
  stats: CharacterStats;
  maxHp: number;
  currentHp: number;
  temporaryHp?: number;
  ac: number;
  speed: number;
  weapons: CharacterWeapon[];
  inventory?: InventoryItem[];
  resistances?: string[];
  abilities: CharacterAbility[];
  spells?: SpellData[];
  spellSlots?: SpellSlotPool[];
  resources?: CharacterResource[];
  skills?: CharacterSkill[];
}
