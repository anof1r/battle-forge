/** Default values pre-filled into the DM "add enemy" form. */
export const DEFAULT_ENEMY_TYPE = 'goblin';
export const DEFAULT_ENEMY_MAX_HP = 10;
export const DEFAULT_ENEMY_AC = 12;
export const ENEMY_DAMAGE_DICE_SIDES = [4, 6, 8, 10, 12] as const;

/** Pools used to randomly generate flavor data (actions/statuses/resistances) for enemies. */
export const WEAPON_NAMES = [
  'Shortsword',
  'Longsword',
  'Greatsword',
  'Dagger',
  'Rapier',
  'Scimitar',
  'Battleaxe',
  'Greataxe',
  'Maul',
  'Warhammer',
  'Spear',
  'Javelin',
  'Longbow',
  'Shortbow',
  'Crossbow',
  'Handaxe',
  'Light Hammer',
  'Mace',
  'Morningstar',
  'Flail',
] as const;

export const DAMAGE_TYPES = [
  'slashing',
  'piercing',
  'bludgeoning',
  'fire',
  'cold',
  'lightning',
  'acid',
  'poison',
  'psychic',
  'necrotic',
  'radiant',
  'thunder',
  'force',
] as const;

export const ACTION_DESCRIPTIONS = [
  'Melee Attack',
  'Ranged Attack',
  'Reach Attack',
  'Multiattack',
  'Special Attack',
  'Area Attack',
  'Bite',
  'Claw',
  'Tail Slap',
] as const;

export const STATUS_EFFECTS = [
  'poisoned',
  'charmed',
  'paralyzed',
  'frightened',
  'restrained',
  'blinded',
  'deafened',
  'stunned',
  'burning',
  'frozen',
  'shocked',
  'exhausted',
  'grappled',
  'incapacitated',
  'prone',
] as const;

export const RESISTANCE_TYPES = [
  'fire',
  'cold',
  'lightning',
  'acid',
  'poison',
  'necrotic',
  'psychic',
  'radiant',
  'thunder',
  'force',
] as const;
