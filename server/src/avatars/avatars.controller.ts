import {
  BadRequestException,
  Controller,
  Delete,
  NotFoundException,
  Param,
  ParseFilePipeBuilder,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { DataGateway } from '../data/data.gateway';
import { DataStoreService } from '../data/data-store.service';
import {
  AVATAR_OWNER_TYPES,
  AvatarOwnerType,
  AvatarReference,
  AvatarUploadResponse,
} from './avatar.model';
import { AvatarStorageService } from './avatar-storage.service';

const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

@Controller('api/avatars')
export class AvatarsController {
  constructor(
    private readonly storage: AvatarStorageService,
    private readonly store: DataStoreService,
    private readonly gateway: DataGateway,
  ) {}

  @Post(':ownerType/:ownerId')
  @UseInterceptors(FileInterceptor('file', { limits: { files: 1, fileSize: MAX_AVATAR_BYTES } }))
  async upload(
    @Param('ownerType') rawOwnerType: string,
    @Param('ownerId') rawOwnerId: string,
    @UploadedFile(
      new ParseFilePipeBuilder()
        .addMaxSizeValidator({ maxSize: MAX_AVATAR_BYTES })
        .addFileTypeValidator({ fileType: /^image\/(jpeg|png|webp)$/ })
        .build(),
    )
    file: Express.Multer.File,
  ): Promise<AvatarUploadResponse> {
    const ownerType = this.ownerType(rawOwnerType);
    const ownerPath = this.ownerPath(ownerType, rawOwnerId);
    const owner = await this.ownerRecord(ownerPath);
    const previousAvatar = this.avatarReference(owner['avatar']);
    const avatar = await this.storage.save(ownerType, file.buffer);

    try {
      await this.store.update(ownerPath, { avatar, lastUpdated: Date.now() });
      await this.gateway.publishRelated(ownerPath);
    } catch (error) {
      await this.storage.remove(avatar);
      throw error;
    }

    await this.storage.remove(previousAvatar);
    return { avatar };
  }

  @Delete(':ownerType/:ownerId')
  async remove(
    @Param('ownerType') rawOwnerType: string,
    @Param('ownerId') rawOwnerId: string,
  ): Promise<{ success: true }> {
    const ownerType = this.ownerType(rawOwnerType);
    const ownerPath = this.ownerPath(ownerType, rawOwnerId);
    const owner = await this.ownerRecord(ownerPath);
    const avatar = this.avatarReference(owner['avatar']);
    await this.store.update(ownerPath, { avatar: null, lastUpdated: Date.now() });
    await this.gateway.publishRelated(ownerPath);
    await this.storage.remove(avatar);
    return { success: true };
  }

  private ownerType(value: string): AvatarOwnerType {
    if (AVATAR_OWNER_TYPES.includes(value as AvatarOwnerType)) {
      return value as AvatarOwnerType;
    }
    throw new BadRequestException('Avatar owner must be a player or creature.');
  }

  private ownerPath(ownerType: AvatarOwnerType, rawOwnerId: string): string {
    const ownerId = rawOwnerId.trim();
    if (!ownerId || /[\\/]/.test(ownerId)) {
      throw new BadRequestException('Invalid avatar owner identifier.');
    }
    return ownerType === 'player'
      ? `players/${ownerId}`
      : `dm-library/creatures/${ownerId}`;
  }

  private async ownerRecord(path: string): Promise<Record<string, unknown>> {
    const owner = await this.store.get(path);
    if (!owner || typeof owner !== 'object' || Array.isArray(owner)) {
      throw new NotFoundException('Avatar owner was not found.');
    }
    return owner as Record<string, unknown>;
  }

  private avatarReference(value: unknown): AvatarReference | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const candidate = value as Partial<AvatarReference>;
    return typeof candidate.key === 'string' && typeof candidate.version === 'number'
      ? { key: candidate.key, version: candidate.version }
      : null;
  }
}