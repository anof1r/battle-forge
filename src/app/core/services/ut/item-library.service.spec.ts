import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FIREBASE_ROOT } from '../../constants/firebase-paths.constants';
import { ItemTemplate } from '../../models';
import { FirebaseService } from '../firebase.service';
import { ItemLibraryService } from '../item-library.service';

describe('ItemLibraryService', () => {
  let service: ItemLibraryService;
  let firebase: {
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
    firebase = {
      set: vi.fn().mockResolvedValue(undefined),
      remove: vi.fn().mockResolvedValue(undefined),
      subscribe: vi.fn().mockReturnValue(of(records)),
    };
    TestBed.configureTestingModule({
      providers: [
        ItemLibraryService,
        { provide: FirebaseService, useValue: firebase },
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

    expect(firebase.subscribe).toHaveBeenCalledWith(FIREBASE_ROOT.ITEM_TEMPLATES);
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
    expect(firebase.set).toHaveBeenLastCalledWith(
      'dm-library/items/item_00000000-0000-4000-8000-000000000020',
      expect.objectContaining({ defaultQuantity: 1, createdAt: 500, lastUpdated: 500 }),
    );

    await service.saveItem({ ...existing, name: 'Большое зелье' });
    expect(firebase.set).toHaveBeenLastCalledWith(
      `dm-library/items/${existing.id}`,
      expect.objectContaining({ name: 'Большое зелье', createdAt: 100, lastUpdated: 500 }),
    );

    await service.deleteItem(existing.id);
    expect(firebase.remove).toHaveBeenCalledWith(`dm-library/items/${existing.id}`);
  });
});
