export interface Enemy {
  id: string;
  name: string;
  type: string;
  maxHp: number;
  currentHp: number;
  ac: number;
  initiative: number;
  status: Record<string, { name: string; duration: number }> | null;
  actions?: EnemyAction[];
  statuses?: string[];
  resistances?: string[];
  lastUpdated: number;
}

export interface EnemyAction {
  name: string;
  description: string;
  toHit: string;
  damage: string;
  damageType: string;
  fullText?: string;
}

export interface EnemyInput {
  name: string;
  type: string;
  maxHp: number;
  ac: number;
  actions?: EnemyAction[];
  statuses?: string[];
  resistances?: string[];
}
