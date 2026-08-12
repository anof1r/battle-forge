/** Lifecycle stage of a battle room. */
export const BATTLE_STATUS = {
  PREPARATION: 'preparation',
  INITIATIVE: 'initiative',
  BATTLE: 'battle',
  ENDED: 'ended',
} as const;
export type BattleStatus = (typeof BATTLE_STATUS)[keyof typeof BATTLE_STATUS];
