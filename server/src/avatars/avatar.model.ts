export const AVATAR_OWNER_TYPES = ['player', 'creature'] as const;

export type AvatarOwnerType = (typeof AVATAR_OWNER_TYPES)[number];

export interface AvatarReference {
  key: string;
  version: number;
}

export interface AvatarUploadResponse {
  avatar: AvatarReference;
}