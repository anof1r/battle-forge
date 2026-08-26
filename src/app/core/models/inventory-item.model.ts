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

export interface GiveItemInput {
  name: string;
  quantity: number;
  description?: string;
  rarity?: ItemRarity;
  effectFormula?: string;
  isStackable?: boolean;
  isConsumable?: boolean;
  icon?: string;
}
