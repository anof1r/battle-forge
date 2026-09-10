import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  AvatarOwnerType,
  AvatarReference,
  AvatarUploadResponse,
} from '../models/avatar.model';

const AVATAR_ENDPOINT = '/api/avatars';
const MEDIA_ENDPOINT = '/media';
const SAFE_MEDIA_KEY = /^avatars\/(players|creatures)\/[0-9a-f-]+\.webp$/i;

export function buildAvatarUrl(avatar: AvatarReference | null | undefined): string | null {
  if (!avatar || !SAFE_MEDIA_KEY.test(avatar.key)) return null;
  const encodedKey = avatar.key.split('/').map(encodeURIComponent).join('/');
  return `${MEDIA_ENDPOINT}/${encodedKey}?v=${avatar.version}`;
}

@Injectable({ providedIn: 'root' })
export class AvatarService {
  private readonly http = inject(HttpClient);

  async upload(
    ownerType: AvatarOwnerType,
    ownerId: string,
    image: Blob,
  ): Promise<AvatarReference> {
    const body = new FormData();
    body.append('file', image, 'avatar.webp');
    const response = await firstValueFrom(
      this.http.post<AvatarUploadResponse>(this.ownerEndpoint(ownerType, ownerId), body),
    );
    return response.avatar;
  }

  async remove(ownerType: AvatarOwnerType, ownerId: string): Promise<void> {
    await firstValueFrom(this.http.delete(this.ownerEndpoint(ownerType, ownerId)));
  }

  url(avatar: AvatarReference | null | undefined): string | null {
    return buildAvatarUrl(avatar);
  }

  private ownerEndpoint(ownerType: AvatarOwnerType, ownerId: string): string {
    return `${AVATAR_ENDPOINT}/${ownerType}/${encodeURIComponent(ownerId)}`;
  }
}
