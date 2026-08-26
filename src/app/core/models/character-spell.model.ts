import { SpellData } from './combatant.model';
import { SpellSlotPool } from './spell-slot.model';

export interface CharacterSpellState {
  spells: SpellData[];
  spellSlots: SpellSlotPool[];
}

export interface CharacterSpellUseResult extends CharacterSpellState {
  used: boolean;
  shouldPersist: boolean;
}
