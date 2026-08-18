/** Kind of entry recorded in the battle action history/log. */
export const BATTLE_ACTION_TYPE = {
  DAMAGE: 'damage',
  HEAL: 'heal',
  STATUS_CHANGE: 'statusChange',
  INITIATIVE: 'initiative',
  TURN: 'turn',
  TEMP_HP: 'temporaryHp',
  RESOURCE: 'resource',
} as const;
export type BattleActionType = (typeof BATTLE_ACTION_TYPE)[keyof typeof BATTLE_ACTION_TYPE];
