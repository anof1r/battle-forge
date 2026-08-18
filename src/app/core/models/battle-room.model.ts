import { BattleStatus } from '../constants/battle-status.constants';
import { Combatant } from './combatant.model';
import { BattleAction } from './action.model';

/** Shape of the data synced to/from Firebase for a room. */
export interface BattleRoom {
  status: BattleStatus;
  currentRound: number;
  currentTurnIndex: number;
  combatants: Record<string, Combatant>;
  initiativeOrder: string[];
  history?: BattleAction[];
  lastUpdated: number;
}

export type SceneTransitionMode = 'preserve' | 'short-rest' | 'long-rest';
