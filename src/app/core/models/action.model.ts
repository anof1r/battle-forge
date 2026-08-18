import { BattleActionType } from '../constants/battle-action.constants';
import type { CombatantStatus } from '../constants/combatant.constants';
import type { DeathSaves } from './combatant.model';

export interface BattleAction {
  id: string;
  timestamp: number;
  type: BattleActionType;
  targetId: string;
  value: number;
  description: string;
  reversible: boolean;
  previousValue?: number;
  previousStatus?: CombatantStatus;
  previousDeathSaves?: DeathSaves;
}
