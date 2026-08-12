import { BattleActionType } from '../constants/battle-action.constants';

export interface BattleAction {
  id: string;
  timestamp: number;
  type: BattleActionType;
  targetId: string;
  value: number;
  description: string;
  reversible: boolean;
  previousValue?: number;
}
