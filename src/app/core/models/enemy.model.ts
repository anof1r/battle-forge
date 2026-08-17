/** A single attack/action a creature can take, shown on its bestiary card. */
export interface EnemyAction {
  name: string;
  description: string;
  toHit: string;
  damage: string;
  damageType: string;
  fullText?: string;
}

/** A passive or special creature ability that does not use the weapon attack fields. */
export interface EnemyAbility {
  name: string;
  description: string;
}
