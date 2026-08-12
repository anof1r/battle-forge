import { BattleStatus } from '../constants/battle-status.constants';
import { Combatant } from './combatant.model';

/** Shape of the data synced to/from Firebase for a room. */
export interface BattleRoom {
  status: BattleStatus;
  currentRound: number;
  currentTurnIndex: number;
  combatants: Record<string, Combatant>;
  initiativeOrder: string[];
  lastUpdated: number;
}
