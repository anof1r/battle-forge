import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AvatarStorageService } from './avatar-storage.service';

describe('AvatarStorageService', () => {
  let mediaRoot: string;
  let originalMediaRoot: string | undefined;
  let service: AvatarStorageService;

  beforeEach(async () => {
    originalMediaRoot = process.env['MEDIA_ROOT'];
    mediaRoot = await mkdtemp(join(tmpdir(), 'battle-forge-avatar-'));
    process.env['MEDIA_ROOT'] = mediaRoot;
    service = new AvatarStorageService();
    await service.onModuleInit();
  });

  afterEach(async () => {
    if (originalMediaRoot === undefined) delete process.env['MEDIA_ROOT'];
    else process.env['MEDIA_ROOT'] = originalMediaRoot;
    await rm(mediaRoot, { force: true, recursive: true });
  });

  it('normalizes an uploaded portrait to a 512px WebP and removes it', async () => {
    const input = await sharp({
      create: { width: 80, height: 120, channels: 3, background: '#c9a84c' },
    })
      .png()
      .toBuffer();

    const avatar = await service.save('player', input);
    const storedPath = join(mediaRoot, ...avatar.key.split('/'));
    const metadata = await sharp(await readFile(storedPath)).metadata();

    expect(avatar.key).toMatch(/^avatars\/players\/[0-9a-f-]+\.webp$/);
    expect(metadata).toMatchObject({ format: 'webp', height: 512, width: 512 });

    await service.remove(avatar);
    await expect(readFile(storedPath)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('rejects data that cannot be decoded as an image', async () => {
    await expect(service.save('creature', Buffer.from('not-an-image'))).rejects.toThrow(
      'supported image',
    );
  });
});