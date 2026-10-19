import { BadRequestException, Injectable, OnModuleInit } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { mkdir, rename, rm } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';
import { readEnvironment } from '../config/environment';
import { SlideMedia } from './slide.model';

const MAX_SLIDE_SIDE = 2560;
const STORED_SLIDE_KEY = /^slides\/[0-9a-f-]+\.webp$/i;

@Injectable()
export class SlideStorageService implements OnModuleInit {
  private readonly mediaRoot = readEnvironment().mediaRoot;

  async onModuleInit(): Promise<void> {
    await mkdir(this.directory(), { recursive: true });
  }

  async save(buffer: Buffer): Promise<SlideMedia> {
    const key = `slides/${randomUUID()}.webp`;
    const destination = this.absolutePath(key);
    const temporary = `${destination}.${randomUUID()}.tmp`;

    try {
      await sharp(buffer, { animated: false, failOn: 'warning', limitInputPixels: 100_000_000 })
        .autoOrient()
        .resize(MAX_SLIDE_SIDE, MAX_SLIDE_SIDE, { fit: 'inside', withoutEnlargement: true })
        .webp({ effort: 4, quality: 86 })
        .toFile(temporary);
      await rename(temporary, destination);
      return { key, version: Date.now() };
    } catch {
      await rm(temporary, { force: true });
      throw new BadRequestException('The uploaded file is not a supported image.');
    }
  }

  async remove(media: SlideMedia | null): Promise<void> {
    if (!media || !STORED_SLIDE_KEY.test(media.key)) return;
    await rm(this.absolutePath(media.key), { force: true });
  }

  private directory(): string {
    return join(this.mediaRoot, 'slides');
  }

  private absolutePath(key: string): string {
    return join(this.mediaRoot, ...key.split('/'));
  }
}
