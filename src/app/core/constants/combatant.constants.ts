/** Whether a combatant is controlled by the DM (enemy) or a player. */
export const COMBATANT_TYPE = {
  PLAYER: 'player',
  ENEMY: 'enemy',
} as const;
export type CombatantType = (typeof COMBATANT_TYPE)[keyof typeof COMBATANT_TYPE];

/** Life state of a combatant. */
export const COMBATANT_STATUS = {
  ALIVE: 'alive',
  DOWNED: 'downed',
  STABLE: 'stable',
  DEAD: 'dead',
} as const;
export type CombatantStatus = (typeof COMBATANT_STATUS)[keyof typeof COMBATANT_STATUS];

export const DEATH_SAVE_RESULT = {
  SUCCESS: 'success',
  FAILURE: 'failure',
  CRITICAL_SUCCESS: 'critical-success',
  CRITICAL_FAILURE: 'critical-failure',
} as const;
export type DeathSaveResult = (typeof DEATH_SAVE_RESULT)[keyof typeof DEATH_SAVE_RESULT];
