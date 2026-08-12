import { CombatantStatus, CombatantType } from '../constants/combatant.constants';
import { EnemyAction } from './enemy.model';

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
  resistances?: string[];
  statuses?: string[];
  lastUpdated?: number;
}
