import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ParsedCharacter } from '../../models/character.model';
import { InventoryItem } from '../../models/inventory-item.model';
import { CharacterService } from '../character.service';
import { InventoryService } from '../inventory.service';

describe('InventoryService', () => {
  let service: InventoryService;
  let characterService: {
    loadCharacter: ReturnType<typeof vi.fn>;
    saveCharacter: ReturnType<typeof vi.fn>;
  };

  const item = (overrides: Partial<InventoryItem> = {}): InventoryItem => ({
    id: 'potion-1',
    name: 'Potion',
    description: 'Restores HP',
    quantity: 2,
    isStackable: true,
    isConsumable: true,
    rarity: 'common',
    icon: '',
    ...overrides,
  });

  const character = (inventory?: InventoryItem[]): ParsedCharacter => ({
    name: 'Aria',
    class: 'Wizard',
    level: 5,
    race: 'Elf',
    stats: { str: 8, dex: 14, con: 12, int: 18, wis: 11, cha: 10 },
    maxHp: 30,
    currentHp: 24,
    ac: 13,
    speed: 30,
    weapons: [],
    abilities: [],
    inventory,
  });

  beforeEach(() => {
    characterService = {
      loadCharacter: vi.fn(),
      saveCharacter: vi.fn().mockResolvedValue(undefined),
    };
    TestBed.configureTestingModule({
      providers: [
        InventoryService,
        { provide: CharacterService, useValue: characterService },
      ],
    });
    service = TestBed.inject(InventoryService);
  });

  it('stacks an existing item and applies supplied metadata', async () => {
    characterService.loadCharacter.mockResolvedValue(character([item()]));

    await service.giveItem('Aria', {
      name: 'Potion',
      quantity: 3,
      description: 'Greater healing',
      rarity: 'rare',
      effectFormula: '2d4+2',
      icon: '🧪',
    });

    expect(characterService.saveCharacter).toHaveBeenCalledWith(
      expect.objectContaining({
        inventory: [
          expect.objectContaining({
            id: 'potion-1',
            quantity: 5,
            description: 'Greater healing',
            rarity: 'rare',
            effectFormula: '2d4+2',
            icon: '🧪',
          }),
        ],
      }),
    );
  });

  it('creates a separate entry when a reusable template is not stackable', async () => {
    characterService.loadCharacter.mockResolvedValue(
      character([item({ isStackable: false })]),
    );
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('00000000-0000-4000-8000-000000000004');

    await service.giveItem('Aria', {
      name: 'Potion',
      quantity: 1,
      isStackable: false,
      isConsumable: false,
    });

    expect(characterService.saveCharacter).toHaveBeenCalledWith(
      expect.objectContaining({
        inventory: [
          expect.objectContaining({ id: 'potion-1', quantity: 2 }),
          expect.objectContaining({
            id: '00000000-0000-4000-8000-000000000004',
            isStackable: false,
            isConsumable: false,
          }),
        ],
      }),
    );
  });

  it('creates a new inventory item with safe defaults', async () => {
    characterService.loadCharacter.mockResolvedValue(character());
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('00000000-0000-4000-8000-000000000001');

    await service.giveItem('Aria', { name: 'Rope', quantity: 1 });

    expect(characterService.saveCharacter).toHaveBeenCalledWith(
      expect.objectContaining({
        inventory: [
          {
            id: '00000000-0000-4000-8000-000000000001',
            name: 'Rope',
            description: '',
            quantity: 1,
            isStackable: true,
            isConsumable: true,
            rarity: 'common',
            icon: '',
          },
        ],
      }),
    );
  });

  it('removes only an item at a valid index', async () => {
    const inventory = [item(), item({ id: 'rope-1', name: 'Rope' })];
    characterService.loadCharacter.mockResolvedValue(character(inventory));

    await service.removeItem('Aria', 0);
    expect(characterService.saveCharacter).toHaveBeenCalledWith(
      expect.objectContaining({ inventory: [expect.objectContaining({ id: 'rope-1' })] }),
    );

    characterService.saveCharacter.mockClear();
    await service.removeItem('Aria', 5);
    expect(characterService.saveCharacter).not.toHaveBeenCalled();
  });

  it('decrements a consumed stack and removes it when exhausted', async () => {
    characterService.loadCharacter
      .mockResolvedValueOnce(character([item({ quantity: 3 })]))
      .mockResolvedValueOnce(character([item({ quantity: 2 })]));

    await expect(service.consumeItem('Aria', 'potion-1', 1)).resolves.toBe(true);
    expect(characterService.saveCharacter).toHaveBeenLastCalledWith(
      expect.objectContaining({
        inventory: [expect.objectContaining({ id: 'potion-1', quantity: 2 })],
      }),
    );

    await expect(service.consumeItem('Aria', 'potion-1', 2)).resolves.toBe(true);
    expect(characterService.saveCharacter).toHaveBeenLastCalledWith(
      expect.objectContaining({ inventory: [] }),
    );
  });

  it('does not save when the player, item, or required quantity is unavailable', async () => {
    characterService.loadCharacter
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(character([item()]))
      .mockResolvedValueOnce(character([item({ quantity: 1 })]));

    await service.giveItem('Missing', { name: 'Potion', quantity: 1 });
    await expect(service.consumeItem('Aria', 'missing', 1)).resolves.toBe(false);
    await expect(service.consumeItem('Aria', 'potion-1', 2)).resolves.toBe(false);

    expect(characterService.saveCharacter).not.toHaveBeenCalled();
  });
});
