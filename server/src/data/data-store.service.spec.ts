import { describe, expect, it } from 'vitest';
import { DataPathResolver } from './data-path';
import { DataStoreService } from './data-store.service';
import {
  RecordPatchOperation,
  RecordRepository,
  StoredRecord,
} from './record.repository';

class InMemoryRecordRepository extends RecordRepository {
  readonly records = new Map<string, unknown>();

  async find(path: string): Promise<StoredRecord | null> {
    return this.records.has(path)
      ? { path, data: structuredClone(this.records.get(path)), updatedAt: 1 }
      : null;
  }

  async findCollection(collectionPath: string): Promise<StoredRecord[]> {
    const prefix = `${collectionPath}/`;
    return [...this.records.entries()]
      .filter(([path]) => path.startsWith(prefix) && !path.slice(prefix.length).includes('/'))
      .map(([path, data]) => ({ path, data: structuredClone(data), updatedAt: 1 }));
  }

  async replace(path: string, data: unknown): Promise<void> {
    this.records.set(path, structuredClone(data));
  }

  async patch(path: string, operations: RecordPatchOperation[]): Promise<void> {
    const current = this.asRecord(structuredClone(this.records.get(path) ?? {}));
    for (const operation of operations) {
      const parent = operation.nestedSegments
        .slice(0, -1)
        .reduce<Record<string, unknown>>((target, segment) => {
          if (!this.isRecord(target[segment])) target[segment] = {};
          return target[segment] as Record<string, unknown>;
        }, current);
      const key = operation.nestedSegments.at(-1)!;
      if (operation.type === 'unset') delete parent[key];
      else parent[key] = structuredClone(operation.value);
    }
    this.records.set(path, current);
  }

  async remove(path: string): Promise<void> {
    this.records.delete(path);
  }

  async removeCollection(collectionPath: string): Promise<void> {
    const prefix = `${collectionPath}/`;
    for (const path of this.records.keys()) {
      if (path.startsWith(prefix)) this.records.delete(path);
    }
  }

  private asRecord(value: unknown): Record<string, unknown> {
    return this.isRecord(value) ? value : {};
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  }
}

describe('DataStoreService', () => {
  const createStore = () => {
    const repository = new InMemoryRecordRepository();
    return { repository, store: new DataStoreService(repository, new DataPathResolver()) };
  };

  it('preserves Firebase collection and entity shapes', async () => {
    const { store } = createStore();
    await store.set('players/Aria', { name: 'Aria', currentHp: 12 });
    await store.set('players/Borin', { name: 'Borin', currentHp: 20 });

    expect(await store.get('players')).toEqual({
      Aria: { name: 'Aria', currentHp: 12 },
      Borin: { name: 'Borin', currentHp: 20 },
    });
    expect(await store.get('players/Aria/currentHp')).toBe(12);
  });

  it('applies Firebase-style multi-location patches without replacing siblings', async () => {
    const { store } = createStore();
    await store.set('rooms/main-room', {
      currentRound: 1,
      combatants: { goblin: { currentHp: 7, maxHp: 7 } },
    });
    await store.update('rooms/main-room', {
      currentRound: 2,
      'combatants/goblin/currentHp': 3,
    });

    expect(await store.get('rooms/main-room')).toEqual({
      currentRound: 2,
      combatants: { goblin: { currentHp: 3, maxHp: 7 } },
    });
  });

  it('treats null as deletion like Realtime Database', async () => {
    const { store } = createStore();
    await store.set('players/Aria', { currentHp: 10, temporaryHp: 4 });
    await store.update('players/Aria', { temporaryHp: null });
    expect(await store.get('players/Aria')).toEqual({ currentHp: 10 });

    await store.remove('players/Aria');
    expect(await store.get('players/Aria')).toBeNull();
  });

  it('replaces complete collections when explicitly requested', async () => {
    const { repository, store } = createStore();
    await store.set('dm-library/items/old', { name: 'Old' });
    await store.set('dm-library/items', { potion: { name: 'Potion' } });

    expect(await store.get('dm-library/items')).toEqual({ potion: { name: 'Potion' } });
    expect(repository.records.has('dm-library/items/old')).toBe(false);
  });
});
