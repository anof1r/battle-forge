import { Enemy } from './enemy.model';

export type BattleStatus = 'preparation' | 'initiative' | 'battle' | 'ended';

export interface BattleScene {
  roomId: string;
  status: BattleStatus;
  currentRound: number;
  currentTurnIndex: number; // index in initiativeOrder
  enemies: Record<string, Enemy>;
  lastUpdated: number;
}

/** Shape of the data synced to/from Firebase for a room. */
export interface BattleRoom {
  status: BattleStatus;
  currentRound: number;
  currentTurnIndex: number;
  enemies: Record<string, Enemy>;
  initiativeOrder: string[];
  lastUpdated: number;
}
