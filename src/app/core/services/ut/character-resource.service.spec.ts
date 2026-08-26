import { describe, expect, it, vi } from 'vitest';
import { CharacterResource } from '../../models/character-resource.model';
import { CharacterResourceService } from '../character-resource.service';

const rage: CharacterResource = {
  id: 'rage',
  name: 'Ярость',
  current: 2,
  max: 3,
  recovery: 'long-rest',
  shortRestRestore: 1,
};

describe('CharacterResourceService', () => {
  const service = new CharacterResourceService();

  it('upserts normalized resources without mutating the source collection', () => {
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('00000000-0000-4000-8000-000000000001');
    const current = [rage];
    const next = service.upsert(current, {
      id: '',
      name: 'Ки',
      current: 8,
      max: 5,
      recovery: 'short-rest',
    });

    expect(current).toEqual([rage]);
    expect(next[1]).toMatchObject({
      id: 'resource_00000000-0000-4000-8000-000000000001',
      name: 'Ки',
      current: 5,
      max: 5,
    });
  });

  it('spends finite pools and leaves unlimited resources unchanged', () => {
    expect(service.spend([rage], rage.id, 2)).toEqual({
      spent: true,
      changed: true,
      resources: [{ ...rage, current: 0 }],
    });
    expect(service.spend([rage], rage.id, 3).spent).toBe(false);

    const unlimited = { ...rage, id: 'sneak-attack', isUnlimited: true };
    expect(service.spend([unlimited], unlimited.id, 99)).toEqual({
      spent: true,
      changed: false,
      resources: [
        {
          id: 'sneak-attack',
          name: 'Ярость',
          isUnlimited: true,
          current: 0,
          max: 0,
          recovery: 'manual',
        },
      ],
    });
  });

  it('restores partial short-rest pools and all non-manual long-rest pools', () => {
    const manual: CharacterResource = {
      id: 'manual',
      name: 'Ручной',
      current: 0,
      max: 2,
      recovery: 'manual',
    };
    expect(service.restore([rage, manual], 'short-rest').map((item) => item.current)).toEqual([3, 0]);
    expect(service.restore([rage, manual], 'long-rest').map((item) => item.current)).toEqual([3, 0]);
  });
});
