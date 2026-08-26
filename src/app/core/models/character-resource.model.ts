export type ResourceRecovery = 'short-rest' | 'long-rest' | 'manual';

export type ResourceSpendMode = 'fixed' | 'variable';

export type ResourceEffectDuration = 'manual' | 'until-next-turn-end' | 'rounds';

export interface CharacterResourceEffect {
  icon?: string;
  duration: ResourceEffectDuration;
  rounds?: number;
}

export interface CharacterResource {
  id: string;
  name: string;
  icon?: string;
  description?: string;
  isUnlimited?: boolean;
  spendMode?: ResourceSpendMode;
  spendAmount?: number;
  shortRestRestore?: number;
  linkedSpellId?: string;
  activeEffect?: CharacterResourceEffect;
  current: number;
  max: number;
  recovery: ResourceRecovery;
}

export interface CharacterResourceSpendResult {
  resources: CharacterResource[];
  spent: boolean;
  changed: boolean;
}
