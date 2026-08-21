import { CombatantStatus, CombatantType } from '../constants/combatant.constants';
import { StatusEffectTrigger, StatusEffectType } from '../constants/status-effect.constants';
import { EnemyAbility, EnemyAction } from './enemy.model';

export interface ActiveStatusEffect {
  id: string;
  type: StatusEffectType;
  appliedAt: number;
  damagePerTrigger?: number;
  trigger?: StatusEffectTrigger;
  remainingTriggers?: number;
  source?: string;
  concentrationSourceId?: string;
  saveAbility?: string;
  saveDc?: number;
  notes?: string;
  resourceId?: string;
  customLabel?: string;
  customIcon?: string;
  durationLabel?: string;
}

export interface StatusEffectOptions {
  damagePerTrigger?: number;
  trigger?: StatusEffectTrigger;
  durationTriggers?: number;
  source?: string;
  concentrationSourceId?: string;
  saveAbility?: string;
  saveDc?: number;
  notes?: string;
  resourceId?: string;
  customLabel?: string;
  customIcon?: string;
  durationLabel?: string;
}

export interface DeathSaves {
  successes: number;
  failures: number;
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
  temporaryHp?: number;
  status: CombatantStatus;
  playerName?: string;
  emoji?: string;
  enemyId?: string;
  actions?: EnemyAction[];
  abilities?: EnemyAbility[];
  resistances?: string[];
  statuses?: string[];
  activeEffects?: ActiveStatusEffect[];
  deathSaves?: DeathSaves;
  lastUpdated?: number;
}

export interface SpellData {
  id: string;
  librarySpellId?: string;
  sourceKey?: string;
  name: string;
  level: number;
  school?: string;
  description?: string;
  damageFormula?: string;
  damageType?: string;
  higherLevel?: string;
  castingTime?: string;
  range?: string;
  duration?: string;
  components?: string;
  isRitual?: boolean;
  requiresConcentration?: boolean;
  isCantrip: boolean;
  isPrepared: boolean;
  maxUses?: number;
  usesRemaining?: number;
}
