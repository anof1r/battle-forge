/** Root Firebase Realtime Database collections used by the app. */
export const FIREBASE_ROOT = {
  ROOMS: 'rooms',
  PLAYERS: 'players',
} as const;

export const MAIN_ROOM_ID = 'main-room';

export function roomPath(roomId: string): string {
  return `${FIREBASE_ROOT.ROOMS}/${roomId}`;
}

export function playerPath(playerName: string): string {
  return `${FIREBASE_ROOT.PLAYERS}/${playerName}`;
}
