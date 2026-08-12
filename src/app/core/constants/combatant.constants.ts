/** Whether a combatant is controlled by the DM (enemy) or a player. */
export const COMBATANT_TYPE = {
  PLAYER: 'player',
  ENEMY: 'enemy',
} as const;
export type CombatantType = (typeof COMBATANT_TYPE)[keyof typeof COMBATANT_TYPE];

/** Life state of a combatant. */
export const COMBATANT_STATUS = {
  ALIVE: 'alive',
  DEAD: 'dead',
} as const;
export type CombatantStatus = (typeof COMBATANT_STATUS)[keyof typeof COMBATANT_STATUS];
