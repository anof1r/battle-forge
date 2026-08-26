import { Injectable } from '@angular/core';
import { CharacterSpellState, CharacterSpellUseResult } from '../models/character-spell.model';
import { SpellData } from '../models/combatant.model';
import { SpellSlotPool } from '../models/spell-slot.model';
import { normalizeSpellSlots } from '../utils/character-normalizer.util';

/** Pure domain rules for prepared spells and shared spell-slot pools. */
@Injectable({ providedIn: 'root' })
export class CharacterSpellService {
  upsert(spells: readonly SpellData[] | null | undefined, spell: SpellData): SpellData[] {
    const current = [...(spells ?? [])];
    const index = current.findIndex((candidate) => candidate.name === spell.name);
    if (index < 0) return [...current, spell];
    return current.map((candidate, candidateIndex) =>
      candidateIndex === index ? { ...candidate, ...spell } : candidate,
    );
  }

  remove(spells: readonly SpellData[] | null | undefined, spellId: string): SpellData[] {
    return (spells ?? []).filter((spell) => spell.id !== spellId);
  }

  use(
    spells: readonly SpellData[] | null | undefined,
    pools: readonly SpellSlotPool[] | null | undefined,
    spellId: string,
    slotLevel?: number,
  ): CharacterSpellUseResult {
    const currentSpells = [...(spells ?? [])];
    const spellSlots = normalizeSpellSlots(pools);
    const spell = currentSpells.find((candidate) => candidate.id === spellId);
    if (!spell?.isPrepared) {
      return { spells: currentSpells, spellSlots, used: false, shouldPersist: false };
    }
    if (spell.isCantrip) {
      return { spells: currentSpells, spellSlots, used: true, shouldPersist: false };
    }

    if (spellSlots.length > 0) {
      const requestedLevel = Math.max(spell.level, Math.floor(slotLevel ?? spell.level));
      const slot = spellSlots.find((candidate) => candidate.level === requestedLevel);
      if (!slot || slot.current <= 0) {
        return { spells: currentSpells, spellSlots, used: false, shouldPersist: false };
      }
      return {
        spells: currentSpells,
        spellSlots: spellSlots.map((candidate) =>
          candidate.level === requestedLevel
            ? { ...candidate, current: candidate.current - 1 }
            : candidate,
        ),
        used: true,
        shouldPersist: true,
      };
    }

    const maxUses = Math.max(1, spell.maxUses ?? 1);
    const usesRemaining = spell.usesRemaining ?? maxUses;
    if (usesRemaining <= 0) {
      return { spells: currentSpells, spellSlots, used: false, shouldPersist: false };
    }
    return {
      spells: currentSpells.map((candidate) =>
        candidate.id === spellId
          ? { ...candidate, maxUses, usesRemaining: usesRemaining - 1 }
          : candidate,
      ),
      spellSlots,
      used: true,
      shouldPersist: true,
    };
  }

  restore(
    spells: readonly SpellData[] | null | undefined,
    pools: readonly SpellSlotPool[] | null | undefined,
  ): CharacterSpellState {
    return {
      spells: (spells ?? []).map((spell) => {
        if (spell.isCantrip) return spell;
        const maxUses = Math.max(1, spell.maxUses ?? 1);
        return { ...spell, maxUses, usesRemaining: maxUses };
      }),
      spellSlots: normalizeSpellSlots(pools).map((slot) => ({ ...slot, current: slot.max })),
    };
  }

  upsertSlot(
    pools: readonly SpellSlotPool[] | null | undefined,
    pool: SpellSlotPool,
  ): SpellSlotPool[] {
    const level = Math.max(1, Math.min(9, Math.floor(pool.level)));
    const max = Math.max(0, Math.floor(pool.max));
    const normalized: SpellSlotPool = {
      level,
      max,
      current: Math.max(0, Math.min(max, Math.floor(pool.current))),
      ...(pool.recovery === 'short-rest' ? { recovery: 'short-rest' as const } : {}),
    };
    const slots = normalizeSpellSlots(pools).filter((slot) => slot.level !== level);
    return [...slots, normalized].sort((left, right) => left.level - right.level);
  }

  restoreShortRestSlots(
    pools: readonly SpellSlotPool[] | null | undefined,
  ): SpellSlotPool[] {
    return normalizeSpellSlots(pools).map((slot) =>
      slot.recovery === 'short-rest' ? { ...slot, current: slot.max } : slot,
    );
  }
}
