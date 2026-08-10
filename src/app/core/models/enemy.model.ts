export interface Enemy {
  id: string;
  name: string;
  type: string;
  maxHp: number;
  currentHp: number;
  ac: number;
  initiative: number;
  // Firebase (Realtime Database) strips empty objects on write, so a fresh
  // enemy with no active statuses will have this field missing entirely.
  status?: EnemyStatus;
  lastUpdated: number;
}

export interface EnemyStatus {
  [key: string]: {
    name: string;
    duration: number; // -1 = permanent until removed
  };
}

export interface EnemyInput {
  name: string;
  type: string;
  maxHp: number;
  ac: number;
}
