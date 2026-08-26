import { BattleRoom } from '../models/battle-room.model';
import { BATTLE_STATUS } from './battle-status.constants';

export const EMPTY_BATTLE_ROOM: BattleRoom = {
  status: BATTLE_STATUS.PREPARATION,
  currentRound: 1,
  currentTurnIndex: 0,
  combatants: {},
  initiativeOrder: [],
  history: [],
  lastUpdated: 0,
};
