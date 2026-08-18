import { BattleActionType } from '../constants/battle-action.constants';
import type { BattleStatus } from '../constants/battle-status.constants';
import type { CombatantStatus } from '../constants/combatant.constants';
import type { Combatant, DeathSaves } from './combatant.model';

export interface BattleUndoState {
  combatants?: Record<string, Combatant | null>;
  initiativeOrder?: string[];
  currentRound?: number;
  currentTurnIndex?: number;
  status?: BattleStatus;
}

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
  undoState?: BattleUndoState;
}
