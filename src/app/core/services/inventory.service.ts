import { Injectable, inject } from '@angular/core';
import { CharacterService } from './character.service';
import { InventoryItem } from '../models/inventory-item.model';
import { ItemRarity } from '../constants/item-rarity.constants';

export interface GiveItemInput {
  name: string;
  quantity: number;
  description?: string;
  rarity?: ItemRarity;
}

/** Business logic for a player's inventory — kept out of `CharacterService` (character CRUD) and components. */
@Injectable({ providedIn: 'root' })
export class InventoryService {
  private readonly characterService = inject(CharacterService);

  async giveItem(playerName: string, item: GiveItemInput): Promise<void> {
    const player = await this.characterService.loadCharacter(playerName);
    if (!player) return;

    const inventory = player.inventory ?? [];
    const existing = inventory.find((i) => i.name === item.name);
    if (existing) {
      existing.quantity += item.quantity;
      if (item.description) existing.description = item.description;
      if (item.rarity) existing.rarity = item.rarity;
    } else {
      const newItem: InventoryItem = {
        id: crypto.randomUUID(),
        name: item.name,
        description: item.description ?? '',
        quantity: item.quantity,
        isStackable: true,
        isConsumable: true,
        rarity: item.rarity ?? 'common',
        icon: '',
      };
      inventory.push(newItem);
    }
    await this.characterService.saveCharacter({ ...player, inventory });
  }

  async removeItem(playerName: string, itemIndex: number): Promise<void> {
    const player = await this.characterService.loadCharacter(playerName);
    if (!player) return;
    const inventory = player.inventory ?? [];
    if (itemIndex < 0 || itemIndex >= inventory.length) return;
    inventory.splice(itemIndex, 1);
    await this.characterService.saveCharacter({ ...player, inventory });
  }

  /** Consumes `quantity` of an item, removing it once it hits zero. Returns false if there wasn't enough. */
  async consumeItem(playerName: string, itemId: string, quantity: number): Promise<boolean> {
    const player = await this.characterService.loadCharacter(playerName);
    if (!player?.inventory) return false;

    const target = player.inventory.find((i) => i.id === itemId);
    if (!target || target.quantity < quantity) return false;

    const inventory = player.inventory
      .map((i) => {
        if (i.id !== itemId) return i;
        const remaining = i.quantity - quantity;
        return remaining > 0 ? { ...i, quantity: remaining } : null;
      })
      .filter((i): i is InventoryItem => i !== null);

    await this.characterService.saveCharacter({ ...player, inventory });
    return true;
  }
}
