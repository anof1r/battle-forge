import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SlideStorageService } from './slide-storage.service';

describe('SlideStorageService', () => {
  let mediaRoot: string;
  let originalMediaRoot: string | undefined;
  let service: SlideStorageService;

  beforeEach(async () => {
    originalMediaRoot = process.env['MEDIA_ROOT'];
    mediaRoot = await mkdtemp(join(tmpdir(), 'battle-forge-slide-'));
    process.env['MEDIA_ROOT'] = mediaRoot;
    service = new SlideStorageService();
    await service.onModuleInit();
  });

  afterEach(async () => {
    if (originalMediaRoot === undefined) delete process.env['MEDIA_ROOT'];
    else process.env['MEDIA_ROOT'] = originalMediaRoot;
    await rm(mediaRoot, { force: true, recursive: true });
  });

  async function image(width: number, height: number): Promise<Buffer> {
    return sharp({ create: { width, height, channels: 3, background: '#2a4d3a' } })
      .png()
      .toBuffer();
  }

  function storedPath(key: string): string {
    return join(mediaRoot, ...key.split('/'));
  }

  it('downscales a large illustration to WebP without cropping', async () => {
    // Arrange
    const source = await image(4000, 2000);

    // Act
    const media = await service.save(source);

    // Assert
    const metadata = await sharp(await readFile(storedPath(media.key))).metadata();
    expect(media.key).toMatch(/^slides\/[0-9a-f-]+\.webp$/);
    expect(metadata).toMatchObject({ format: 'webp', width: 2560, height: 1280 });
  });

  it('keeps small images at their original size', async () => {
    // Arrange
    const source = await image(640, 360);

    // Act
    const media = await service.save(source);

    // Assert
    const metadata = await sharp(storedPath(media.key)).metadata();
    expect(metadata).toMatchObject({ width: 640, height: 360 });
  });

  it('deletes the stored file on remove', async () => {
    // Arrange
    const media = await service.save(await image(64, 64));

    // Act
    await service.remove(media);

    // Assert
    await expect(readFile(storedPath(media.key))).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('rejects data that cannot be decoded as an image', async () => {
    // Arrange
    const source = Buffer.from('not-an-image');

    // Act
    const result = service.save(source);

    // Assert
    await expect(result).rejects.toThrow('supported image');
  });

  it('ignores keys outside the slide directory when removing', async () => {
    // Arrange
    const foreign = { key: 'avatars/players/x.webp', version: 1 };

    // Act
    const result = service.remove(foreign);

    // Assert
    await expect(result).resolves.toBeUndefined();
  });
});
