import { BadRequestException, Injectable, OnModuleInit } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { mkdir, rename, rm } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';
import { readEnvironment } from '../config/environment';
import { AvatarOwnerType, AvatarReference } from './avatar.model';

const AVATAR_SIZE = 512;
const STORED_AVATAR_KEY = /^avatars\/(players|creatures)\/[0-9a-f-]+\.webp$/i;

@Injectable()
export class AvatarStorageService implements OnModuleInit {
  private readonly mediaRoot = readEnvironment().mediaRoot;

  async onModuleInit(): Promise<void> {
    await Promise.all([
      mkdir(this.ownerDirectory('player'), { recursive: true }),
      mkdir(this.ownerDirectory('creature'), { recursive: true }),
    ]);
  }

  async save(ownerType: AvatarOwnerType, buffer: Buffer): Promise<AvatarReference> {
    const id = randomUUID();
    const key = `avatars/${ownerType}s/${id}.webp`;
    const destination = this.absolutePath(key);
    const temporary = `${destination}.${randomUUID()}.tmp`;

    try {
      await sharp(buffer, {
        animated: false,
        failOn: 'warning',
        limitInputPixels: 40_000_000,
      })
        .autoOrient()
        .resize(AVATAR_SIZE, AVATAR_SIZE, { fit: 'cover', position: 'centre' })
        .webp({ effort: 4, quality: 84 })
        .toFile(temporary);
      await rename(temporary, destination);
      return { key, version: Date.now() };
    } catch (error) {
      await rm(temporary, { force: true });
      if (error instanceof BadRequestException) throw error;
      throw new BadRequestException('The uploaded file is not a supported image.');
    }
  }

  async remove(avatar: AvatarReference | null): Promise<void> {
    if (!avatar || !STORED_AVATAR_KEY.test(avatar.key)) return;
    await rm(this.absolutePath(avatar.key), { force: true });
  }

  private ownerDirectory(ownerType: AvatarOwnerType): string {
    return join(this.mediaRoot, 'avatars', `${ownerType}s`);
  }

  private absolutePath(key: string): string {
    return join(this.mediaRoot, ...key.split('/'));
  }
}