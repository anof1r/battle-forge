import { ItemRarity } from '../constants/item-rarity.constants';

export interface ItemTemplate {
  id: string;
  name: string;
  description: string;
  effectFormula: string;
  defaultQuantity: number;
  rarity: ItemRarity;
  isStackable: boolean;
  isConsumable: boolean;
  icon: string;
  createdAt: number;
  lastUpdated: number;
}

export type ItemTemplateDraft = Omit<ItemTemplate, 'id' | 'createdAt' | 'lastUpdated'> & {
  id?: string;
};
