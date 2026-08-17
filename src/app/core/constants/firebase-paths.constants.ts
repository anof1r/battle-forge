/** Root Firebase Realtime Database collections used by the app. */
export const FIREBASE_ROOT = {
  ROOMS: 'rooms',
  PLAYERS: 'players',
  CREATURE_TEMPLATES: 'dm-library/creatures',
  SCENE_PRESETS: 'dm-library/scenes',
} as const;

export const MAIN_ROOM_ID = 'main-room';

export function roomPath(roomId: string): string {
  return `${FIREBASE_ROOT.ROOMS}/${roomId}`;
}

export function playerPath(playerName: string): string {
  return `${FIREBASE_ROOT.PLAYERS}/${playerName}`;
}

export function creatureTemplatePath(templateId: string): string {
  return `${FIREBASE_ROOT.CREATURE_TEMPLATES}/${templateId}`;
}

export function scenePresetPath(sceneId: string): string {
  return `${FIREBASE_ROOT.SCENE_PRESETS}/${sceneId}`;
}
