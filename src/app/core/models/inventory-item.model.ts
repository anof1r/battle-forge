import { ItemRarity } from '../constants/item-rarity.constants';

export interface InventoryItem {
  id: string;
  name: string;
  description: string;
  effectFormula?: string;
  quantity: number;
  isStackable: boolean;
  isConsumable: boolean;
  rarity?: ItemRarity;
  icon?: string;
}
