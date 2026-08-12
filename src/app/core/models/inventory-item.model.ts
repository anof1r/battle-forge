import { ItemRarity } from '../constants/item-rarity.constants';

export interface InventoryItem {
  id: string;
  name: string;
  description: string;
  quantity: number;
  isStackable: boolean;
  isConsumable: boolean;
  rarity?: ItemRarity;
  icon?: string;
}
