import type { StatusEffectType } from '../constants/status-effect.constants';

export interface StatusEffectDefinition {
  type: StatusEffectType;
  label: string;
  icon: string;
  description: string;
  beneficial: boolean;
  damageCapable: boolean;
}
