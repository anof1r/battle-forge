import { CombatantStatus, CombatantType } from '../constants/combatant.constants';
import { StatusEffectType } from '../constants/status-effect.constants';
import { EnemyAbility, EnemyAction } from './enemy.model';

export interface ActiveStatusEffect {
  id: string;
  type: StatusEffectType;
  appliedAt: number;
}

export interface Combatant {
  id: string;
  type: CombatantType;
  subtype?: string;
  name: string;
  initiative: number;
  ac: number;
  maxHp: number;
  currentHp: number;
  status: CombatantStatus;
  playerName?: string;
  emoji?: string;
  enemyId?: string;
  actions?: EnemyAction[];
  abilities?: EnemyAbility[];
  resistances?: string[];
  statuses?: string[];
  activeEffects?: ActiveStatusEffect[];
  lastUpdated?: number;
}

export interface SpellData {
  id: string;
  name: string;
  level: number;
  school?: string;
  description?: string;
  damageFormula?: string;
  damageType?: string;
  isCantrip: boolean;
  isPrepared: boolean;
  maxUses?: number;
  usesRemaining?: number;
}
