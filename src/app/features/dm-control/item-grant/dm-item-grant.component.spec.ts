import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ITEM_RARITY } from '../../../core/constants/item-rarity.constants';
import { BattleService } from '../../../core/services/battle.service';
import { InventoryService } from '../../../core/services/inventory.service';
import { LoggerService } from '../../../core/services/logger.service';
import { DmItemGrantComponent } from './dm-item-grant.component';

describe('DmItemGrantComponent', () => {
  let component: DmItemGrantComponent;
  let inventory: { giveItem: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    inventory = { giveItem: vi.fn().mockResolvedValue(undefined) };
    TestBed.configureTestingModule({
      imports: [DmItemGrantComponent],
      providers: [
        { provide: BattleService, useValue: { playersInBattle: signal({}) } },
        { provide: InventoryService, useValue: inventory },
        { provide: LoggerService, useValue: { error: vi.fn() } },
      ],
    });
    component = TestBed.createComponent(DmItemGrantComponent).componentInstance;
  });

  it('gives a normalized item and resets after success', async () => {
    component.selectedPlayerId.set('player_Aria');
    component.itemName.set('  Potion  ');
    component.description.set('  Restores HP  ');
    component.quantity.set(2);
    component.rarity.set(ITEM_RARITY.RARE);

    component.giveItem();

    await vi.waitFor(() =>
      expect(inventory.giveItem).toHaveBeenCalledWith('Aria', {
        name: 'Potion',
        description: 'Restores HP',
        quantity: 2,
        rarity: ITEM_RARITY.RARE,
      }),
    );
    expect(component.selectedPlayerId()).toBeNull();
    expect(component.itemName()).toBe('');
    expect(component.rarity()).toBe(ITEM_RARITY.COMMON);
  });

  it('normalizes invalid quantities at the DOM boundary', () => {
    component.onQuantityInput({ target: { value: '-4' } } as unknown as Event);
    expect(component.quantity()).toBe(1);
  });
});
