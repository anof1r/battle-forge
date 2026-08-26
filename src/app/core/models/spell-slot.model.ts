import { ResourceRecovery } from './character-resource.model';

export interface SpellSlotPool {
  level: number;
  current: number;
  max: number;
  recovery?: Exclude<ResourceRecovery, 'manual'>;
}
