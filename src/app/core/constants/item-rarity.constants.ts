/** Rarity tiers for inventory items. */
export const ITEM_RARITY = {
  COMMON: 'common',
  UNCOMMON: 'uncommon',
  RARE: 'rare',
  EPIC: 'epic',
  LEGENDARY: 'legendary',
} as const;
export type ItemRarity = (typeof ITEM_RARITY)[keyof typeof ITEM_RARITY];
