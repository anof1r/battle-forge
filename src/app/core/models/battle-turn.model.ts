import { Combatant } from './combatant.model';

export interface ProcessedTurnEffects {
  combatant: Combatant;
  changed: boolean;
}
