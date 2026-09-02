import { signal, WritableSignal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { COMBATANT_STATUS, COMBATANT_TYPE } from '../../../core/constants/combatant.constants';
import { ItemTemplate } from '../../../core/models';
import { BattleService } from '../../../core/services/battle.service';
import { InventoryService } from '../../../core/services/inventory.service';
import { ItemLibraryService } from './item-library.service';
import { LoggerService } from '../../../core/services/logger.service';
import { DmItemLibraryComponent } from './dm-item-library.component';

describe('DmItemLibraryComponent', () => {
  let fixture: ComponentFixture<DmItemLibraryComponent>;
  let component: DmItemLibraryComponent;
  let library: {
    items: WritableSignal<ItemTemplate[]>;
    saveItem: ReturnType<typeof vi.fn>;
    deleteItem: ReturnType<typeof vi.fn>;
  };
  let inventory: { giveItem: ReturnType<typeof vi.fn> };

  const potion: ItemTemplate = {
    id: 'item-potion',
    name: 'Зелье лечения',
    description: 'Восстанавливает HP',
    effectFormula: '2d4+2',
    defaultQuantity: 4,
    rarity: 'uncommon',
    isStackable: true,
    isConsumable: true,
    icon: '🧪',
    createdAt: 100,
    lastUpdated: 100,
  };

  beforeEach(() => {
    library = {
      items: signal([potion]),
      saveItem: vi.fn().mockResolvedValue('item-new'),
      deleteItem: vi.fn().mockResolvedValue(undefined),
    };
    inventory = { giveItem: vi.fn().mockResolvedValue(undefined) };

    TestBed.configureTestingModule({
      imports: [DmItemLibraryComponent],
      providers: [
        { provide: ItemLibraryService, useValue: library },
        { provide: InventoryService, useValue: inventory },
        {
          provide: BattleService,
          useValue: {
            playersInBattle: signal({
              player_aria: {
                id: 'player_aria',
                type: COMBATANT_TYPE.PLAYER,
                name: 'Aria',
                playerName: 'Aria',
                initiative: 12,
                ac: 14,
                maxHp: 24,
                currentHp: 20,
                status: COMBATANT_STATUS.ALIVE,
              },
            }),
          },
        },
        { provide: LoggerService, useValue: { error: vi.fn() } },
      ],
    });

    fixture = TestBed.createComponent(DmItemLibraryComponent);
    component = fixture.componentInstance;
  });

  it('saves a reusable template and resets the editor after success', async () => {
    component.itemName.set('  Факел  ');
    component.itemDescription.set('  Освещает область  ');
    component.itemDefaultQuantity.set(3);
    component.itemConsumable.set(false);

    component.saveItem();

    await vi.waitFor(() =>
      expect(library.saveItem).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Факел',
          description: 'Освещает область',
          defaultQuantity: 3,
          isConsumable: false,
        }),
      ),
    );
    await vi.waitFor(() => expect(component.itemName()).toBe(''));
    expect(component.feedback()).toBe('Предмет сохранён в библиотеку.');
  });

  it('uses the template defaults and gives all saved metadata to the player', async () => {
    component.selectedPlayerId.set('player_aria');
    component.selectedTemplateId.set(potion.id);
    component.giveQuantity.set(potion.defaultQuantity);

    component.giveItem();

    await vi.waitFor(() =>
      expect(inventory.giveItem).toHaveBeenCalledWith('Aria', {
        name: potion.name,
        quantity: 4,
        description: potion.description,
        rarity: potion.rarity,
        effectFormula: potion.effectFormula,
        isStackable: true,
        isConsumable: true,
        icon: potion.icon,
      }),
    );
    expect(component.feedback()).toContain('Aria');
  });

  it('loads a saved item into the editor without changing the library record', () => {
    component.editItem(potion);

    expect(component.itemId()).toBe(potion.id);
    expect(component.itemName()).toBe(potion.name);
    expect(component.itemEffectFormula()).toBe('2d4+2');
    expect(library.items()[0]).toEqual(potion);
  });
});
