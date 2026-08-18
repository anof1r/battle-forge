import { SpellData } from './combatant.model';
import { InventoryItem } from './inventory-item.model';

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
  ability: string;
}

export interface CharacterAbility {
  name: string;
  description: string;
  source?: 'resource' | 'feat';
}

export type ResourceRecovery = 'short-rest' | 'long-rest' | 'manual';

export interface CharacterResource {
  id: string;
  name: string;
  current: number;
  max: number;
  recovery: ResourceRecovery;
}

export interface SpellSlotPool {
  level: number;
  current: number;
  max: number;
  recovery?: Exclude<ResourceRecovery, 'manual'>;
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
}

// --- Raw LSS (Long Story Short) character sheet JSON shape ---
// Field values are almost always wrapped as `{ value: T }`; unknown/optional
// sub-trees are typed loosely on purpose since the export format isn't versioned.

export interface LssValue<T> {
  value?: T;
}

export interface LssStat {
  score?: number;
}

export interface LssStatsBlock {
  str?: LssStat;
  dex?: LssStat;
  con?: LssStat;
  int?: LssStat;
  wis?: LssStat;
  cha?: LssStat;
}

export interface LssVitalityBlock {
  'hp-max'?: LssValue<number>;
  'hp-current'?: LssValue<number>;
  speed?: LssValue<number>;
  ac?: LssValue<number | string>;
}

export interface LssWeaponEntry {
  name?: LssValue<string>;
  dmg?: LssValue<string>;
  dmgType?: LssValue<string>;
  ability?: string;
}

export interface LssResourceEntry {
  isDeleted?: boolean;
  name?: string;
  notes?: string;
  value?: number | LssValue<number>;
  current?: number | LssValue<number>;
  max?: number | LssValue<number>;
  recovery?: string;
}

export interface LssTextNode {
  type: string;
  text?: string;
  attrs?: { formula?: string };
  content?: LssTextNode[];
}

export interface LssTextBlockValue {
  data?: { content?: LssTextNode[] };
}

export interface LssTextSection {
  traits?: LssValue<LssTextBlockValue>;
  feats?: LssValue<LssTextBlockValue>;
}

export interface LssCharacterData {
  name?: LssValue<string>;
  info?: {
    charClass?: LssValue<string>;
    level?: LssValue<number>;
    race?: LssValue<string>;
  };
  stats?: LssStatsBlock;
  vitality?: LssVitalityBlock;
  weaponsList?: LssWeaponEntry[];
  resources?: Record<string, LssResourceEntry>;
  text?: LssTextSection;
}

/** Top-level LSS export payload; `data` may arrive as an inline object or a JSON string. */
export interface LssCharacterSheet {
  data?: LssCharacterData | string;
  [key: string]: unknown;
}
