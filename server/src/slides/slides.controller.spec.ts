import { BadRequestException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { DataGateway } from '../data/data.gateway';
import { DataStoreService } from '../data/data-store.service';
import { SlideStorageService } from './slide-storage.service';
import { SlidesController } from './slides.controller';

const ID_A = '00000000-0000-4000-8000-00000000000a';
const ID_B = '00000000-0000-4000-8000-00000000000b';
const ID_C = '00000000-0000-4000-8000-00000000000c';
const UNKNOWN_ID = '00000000-0000-4000-8000-0000000000ff';

function slide(id: string, order: number) {
  return {
    id,
    name: `${order}.png`,
    sectionId: `${order}`,
    order,
    media: { key: `slides/${id}.webp`, version: 1 },
  };
}

function setup(options: { slides?: Record<string, unknown> | null; presentation?: unknown } = {}) {
  const slides =
    options.slides === undefined
      ? { [ID_A]: slide(ID_A, 0), [ID_B]: slide(ID_B, 1), [ID_C]: slide(ID_C, 2) }
      : options.slides;
  const media = { key: 'slides/new.webp', version: 99 };
  const storage = {
    save: vi.fn().mockResolvedValue(media),
    remove: vi.fn().mockResolvedValue(undefined),
  };
  const store = {
    get: vi.fn(async (path: string) =>
      path === 'dm-library/slides' ? slides : (options.presentation ?? null),
    ),
    set: vi.fn().mockResolvedValue(undefined),
    remove: vi.fn().mockResolvedValue(undefined),
    update: vi.fn().mockResolvedValue(undefined),
  };
  const gateway = { publishRelated: vi.fn().mockResolvedValue(undefined) };
  const controller = new SlidesController(
    storage as unknown as SlideStorageService,
    store as unknown as DataStoreService,
    gateway as unknown as DataGateway,
  );
  return { controller, gateway, media, storage, store };
}

describe('SlidesController', () => {
  const file = { buffer: Buffer.from('image') } as Express.Multer.File;

  describe('upload', () => {
    it('appends the slide to the end of the deck', async () => {
      // Arrange
      const { controller, media, store } = setup();

      // Act
      const { slide: created } = await controller.upload({ name: ' 4.png ', sectionId: '4' }, file);

      // Assert
      expect(created).toMatchObject({ name: '4.png', sectionId: '4', order: 3, media });
      expect(store.set).toHaveBeenCalledWith(`dm-library/slides/${created.id}`, created);
    });

    it('publishes the slides collection', async () => {
      // Arrange
      const { controller, gateway } = setup();

      // Act
      await controller.upload({ name: 'a.png', sectionId: 'a' }, file);

      // Assert
      expect(gateway.publishRelated).toHaveBeenCalledWith('dm-library/slides');
    });

    it('starts an empty deck at order zero', async () => {
      // Arrange
      const { controller } = setup({ slides: null });

      // Act
      const { slide: created } = await controller.upload({ name: 'a.png', sectionId: 'a' }, file);

      // Assert
      expect(created.order).toBe(0);
    });

    it('removes the stored file when the database write fails', async () => {
      // Arrange
      const { controller, media, storage, store } = setup();
      store.set.mockRejectedValueOnce(new Error('database unavailable'));

      // Act
      const result = controller.upload({ name: 'a.png', sectionId: 'a' }, file);

      // Assert
      await expect(result).rejects.toThrow('database unavailable');
      expect(storage.remove).toHaveBeenCalledWith(media);
    });
  });

  describe('remove', () => {
    it('deletes the record and the stored file', async () => {
      // Arrange
      const { controller, storage, store } = setup({
        presentation: { mode: 'story', activeSlideId: ID_A },
      });

      // Act
      const result = await controller.remove(ID_B);

      // Assert
      expect(result).toEqual({ success: true });
      expect(store.remove).toHaveBeenCalledWith(`dm-library/slides/${ID_B}`);
      expect(storage.remove).toHaveBeenCalledWith(slide(ID_B, 1).media);
    });

    it('moves the active slide to the next one when the active slide is deleted', async () => {
      // Arrange
      const { controller, gateway, store } = setup({
        presentation: { mode: 'story', activeSlideId: ID_B },
      });

      // Act
      await controller.remove(ID_B);

      // Assert
      expect(store.update).toHaveBeenCalledWith(
        'settings/presentation',
        expect.objectContaining({ activeSlideId: ID_C }),
      );
      expect(store.update.mock.calls[0][1]).not.toHaveProperty('mode');
      expect(gateway.publishRelated).toHaveBeenCalledWith('settings/presentation');
    });

    it('falls back to the previous slide when the last slide is deleted', async () => {
      // Arrange
      const { controller, store } = setup({
        presentation: { mode: 'story', activeSlideId: ID_C },
      });

      // Act
      await controller.remove(ID_C);

      // Assert
      expect(store.update).toHaveBeenCalledWith(
        'settings/presentation',
        expect.objectContaining({ activeSlideId: ID_B }),
      );
    });

    it('returns the display to battle when the final slide is deleted', async () => {
      // Arrange
      const { controller, store } = setup({
        slides: { [ID_A]: slide(ID_A, 0) },
        presentation: { mode: 'story', activeSlideId: ID_A },
      });

      // Act
      await controller.remove(ID_A);

      // Assert
      expect(store.update).toHaveBeenCalledWith(
        'settings/presentation',
        expect.objectContaining({ activeSlideId: null, mode: 'battle' }),
      );
    });

    it('leaves the presentation untouched when another slide is deleted', async () => {
      // Arrange
      const { controller, store } = setup({
        presentation: { mode: 'story', activeSlideId: ID_A },
      });

      // Act
      await controller.remove(ID_C);

      // Assert
      expect(store.update).not.toHaveBeenCalled();
    });

    it('rejects malformed identifiers', async () => {
      // Arrange
      const { controller, store } = setup();

      // Act
      const result = controller.remove('../escape');

      // Assert
      await expect(result).rejects.toBeInstanceOf(BadRequestException);
      expect(store.remove).not.toHaveBeenCalled();
    });

    it('rejects unknown slides', async () => {
      // Arrange
      const { controller, store } = setup();

      // Act
      const result = controller.remove(UNKNOWN_ID);

      // Assert
      await expect(result).rejects.toBeInstanceOf(NotFoundException);
      expect(store.remove).not.toHaveBeenCalled();
    });
  });
});
