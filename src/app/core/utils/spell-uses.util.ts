import { SpellData } from '../models/combatant.model';
export function getSpellMaxUses(spell: SpellData): number {
  return Math.max(1, spell.maxUses ?? 1);
}
export function getSpellUsesRemaining(spell: SpellData): number {
  return Math.max(0, spell.usesRemaining ?? getSpellMaxUses(spell));
}
