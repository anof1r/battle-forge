import { Combatant } from '../models/combatant.model';

/** Returns combatant ids ordered by descending initiative (highest goes first). */
export function sortByInitiativeDesc(combatants: Record<string, Combatant>): string[] {
  return Object.values(combatants)
    .sort((a, b) => b.initiative - a.initiative)
    .map((c) => c.id);
}
