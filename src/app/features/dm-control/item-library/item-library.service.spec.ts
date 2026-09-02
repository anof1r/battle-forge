import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DATA_ROOT } from '../../../core/constants/data-paths.constants';
import { ItemTemplate } from '../../../core/models';
import { RealtimeDataService } from '../../../core/services/realtime-data.service';
import { ItemLibraryService } from './item-library.service';

describe('ItemLibraryService', () => {
  let service: ItemLibraryService;
  let realtimeData: {
    set: ReturnType<typeof vi.fn>;
    remove: ReturnType<typeof vi.fn>;
    subscribe: ReturnType<typeof vi.fn>;
  };

  const potion = (overrides: Partial<ItemTemplate> = {}): ItemTemplate => ({
    id: 'item-potion',
    name: 'Зелье лечения',
    description: 'Восстанавливает HP',
    effectFormula: '1d4',
    defaultQuantity: 4,
    rarity: 'common',
    isStackable: true,
    isConsumable: true,
    icon: '🧪',
    createdAt: 100,
    lastUpdated: 100,
    ...overrides,
  });

  function setup(records: Record<string, Partial<ItemTemplate>> | null = null): void {
    realtimeData = {
      set: vi.fn().mockResolvedValue(undefined),
      remove: vi.fn().mockResolvedValue(undefined),
      subscribe: vi.fn().mockReturnValue(of(records)),
    };
    TestBed.configureTestingModule({
      providers: [
        ItemLibraryService,
        { provide: RealtimeDataService, useValue: realtimeData },
      ],
    });
    service = TestBed.inject(ItemLibraryService);
  }

  beforeEach(() => {
    vi.spyOn(Date, 'now').mockReturnValue(500);
  });

  it('normalizes legacy records and sorts the realtime library', () => {
    setup({
      potion: potion(),
      rope: { id: 'rope', name: 'Верёвка' },
    });

    expect(realtimeData.subscribe).toHaveBeenCalledWith(DATA_ROOT.ITEM_TEMPLATES);
    expect(service.items().map((item) => item.name)).toEqual(['Верёвка', 'Зелье лечения']);
    expect(service.items()[0]).toEqual(
      expect.objectContaining({
        defaultQuantity: 1,
        effectFormula: '',
        rarity: 'common',
        isStackable: true,
        isConsumable: true,
      }),
    );
  });

  it('creates, updates, and deletes reusable item templates', async () => {
    const existing = potion();
    setup({ [existing.id]: existing });
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('00000000-0000-4000-8000-000000000020');

    await expect(
      service.saveItem({
        name: 'Факел',
        description: 'Освещает область',
        effectFormula: '',
        defaultQuantity: 0,
        rarity: 'common',
        isStackable: true,
        isConsumable: true,
        icon: '🔥',
      }),
    ).resolves.toBe('item_00000000-0000-4000-8000-000000000020');
    expect(realtimeData.set).toHaveBeenLastCalledWith(
      'dm-library/items/item_00000000-0000-4000-8000-000000000020',
      expect.objectContaining({ defaultQuantity: 1, createdAt: 500, lastUpdated: 500 }),
    );

    await service.saveItem({ ...existing, name: 'Большое зелье' });
    expect(realtimeData.set).toHaveBeenLastCalledWith(
      `dm-library/items/${existing.id}`,
      expect.objectContaining({ name: 'Большое зелье', createdAt: 100, lastUpdated: 500 }),
    );

    await service.deleteItem(existing.id);
    expect(realtimeData.remove).toHaveBeenCalledWith(`dm-library/items/${existing.id}`);
  });
});
