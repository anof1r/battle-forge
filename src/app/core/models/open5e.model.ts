import { EnemyAbility, EnemyAction } from './enemy.model';

export type Open5eContentKind = 'spell' | 'creature' | 'weapon';

export interface Open5eDocumentRef {
  key: string;
  name: string;
  permalink: string;
}

interface Open5eEntryBase {
  key: string;
  name: string;
  description: string;
  document: Open5eDocumentRef;
}

export interface Open5eSpell extends Open5eEntryBase {
  kind: 'spell';
  level: number;
  school: string;
  higherLevel: string;
  damageFormula: string;
  damageTypes: string[];
  castingTime: string;
  range: string;
  duration: string;
  components: string;
  ritual: boolean;
  concentration: boolean;
}

export interface Open5eWeapon extends Open5eEntryBase {
  kind: 'weapon';
  damageFormula: string;
  damageType: string;
  properties: string[];
  range: string;
}

export interface Open5eCreature extends Open5eEntryBase {
  kind: 'creature';
  subtype: string;
  challengeRating: number;
  maxHp: number;
  ac: number;
  resistances: string[];
  actions: EnemyAction[];
  abilities: EnemyAbility[];
}

export type Open5eEntry = Open5eSpell | Open5eWeapon | Open5eCreature;
