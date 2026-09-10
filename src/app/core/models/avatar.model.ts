export const AVATAR_OWNER_TYPE = {
  PLAYER: 'player',
  CREATURE: 'creature',
} as const;

export type AvatarOwnerType = (typeof AVATAR_OWNER_TYPE)[keyof typeof AVATAR_OWNER_TYPE];

export interface AvatarReference {
  key: string;
  version: number;
}

export interface AvatarUploadResponse {
  avatar: AvatarReference;
}
