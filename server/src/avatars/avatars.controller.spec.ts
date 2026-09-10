import { describe, expect, it, vi } from 'vitest';
import { DataGateway } from '../data/data.gateway';
import { DataStoreService } from '../data/data-store.service';
import { AvatarStorageService } from './avatar-storage.service';
import { AvatarsController } from './avatars.controller';

describe('AvatarsController', () => {
  const avatar = {
    key: 'avatars/players/00000000-0000-4000-8000-000000000001.webp',
    version: 123,
  };
  const previous = {
    key: 'avatars/players/00000000-0000-4000-8000-000000000002.webp',
    version: 100,
  };

  function setup(owner: Record<string, unknown> = { name: 'Aria', avatar: previous }) {
    const storage = {
      save: vi.fn().mockResolvedValue(avatar),
      remove: vi.fn().mockResolvedValue(undefined),
    };
    const store = {
      get: vi.fn().mockResolvedValue(owner),
      update: vi.fn().mockResolvedValue(undefined),
    };
    const gateway = { publishRelated: vi.fn().mockResolvedValue(undefined) };
    const controller = new AvatarsController(
      storage as unknown as AvatarStorageService,
      store as unknown as DataStoreService,
      gateway as unknown as DataGateway,
    );
    return { controller, gateway, storage, store };
  }

  it('stores the new file, updates its owner, publishes the change, and removes the old file', async () => {
    const { controller, gateway, storage, store } = setup();
    const file = { buffer: Buffer.from('image') } as Express.Multer.File;

    await expect(controller.upload('player', 'Aria', file)).resolves.toEqual({ avatar });

    expect(storage.save).toHaveBeenCalledWith('player', file.buffer);
    expect(store.update).toHaveBeenCalledWith(
      'players/Aria',
      expect.objectContaining({ avatar }),
    );
    expect(gateway.publishRelated).toHaveBeenCalledWith('players/Aria');
    expect(storage.remove).toHaveBeenLastCalledWith(previous);
  });

  it('cleans up the new file when the database update fails', async () => {
    const { controller, storage, store } = setup();
    store.update.mockRejectedValueOnce(new Error('database unavailable'));

    await expect(
      controller.upload('creature', 'goblin', { buffer: Buffer.from('image') } as Express.Multer.File),
    ).rejects.toThrow('database unavailable');
    expect(storage.remove).toHaveBeenCalledWith(avatar);
  });

  it('clears the database reference before deleting the stored file', async () => {
    const { controller, gateway, storage, store } = setup();

    await expect(controller.remove('player', 'Aria')).resolves.toEqual({ success: true });

    expect(store.update).toHaveBeenCalledWith(
      'players/Aria',
      expect.objectContaining({ avatar: null }),
    );
    expect(gateway.publishRelated).toHaveBeenCalledWith('players/Aria');
    expect(storage.remove).toHaveBeenCalledWith(previous);
  });
});