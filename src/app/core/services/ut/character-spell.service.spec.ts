import { describe, expect, it } from 'vitest';
import { SpellData } from '../../models/combatant.model';
import { CharacterSpellService } from '../character-spell.service';

const spell: SpellData = {
  id: 'fireball',
  name: 'Огненный шар',
  level: 3,
  isPrepared: true,
  isCantrip: false,
};

describe('CharacterSpellService', () => {
  const service = new CharacterSpellService();

  it('spends the explicitly selected shared slot', () => {
    const result = service.use(
      [spell],
      [
        { level: 3, current: 1, max: 1 },
        { level: 4, current: 2, max: 2 },
      ],
      spell.id,
      4,
    );

    expect(result.used).toBe(true);
    expect(result.shouldPersist).toBe(true);
    expect(result.spellSlots).toEqual([
      { level: 3, current: 1, max: 1 },
      { level: 4, current: 1, max: 2 },
    ]);
  });

  it('does not persist cantrips or invalid spell use', () => {
    expect(service.use([{ ...spell, isCantrip: true }], [], spell.id)).toMatchObject({
      used: true,
      shouldPersist: false,
    });
    expect(service.use([{ ...spell, isPrepared: false }], [], spell.id)).toMatchObject({
      used: false,
      shouldPersist: false,
    });
  });

  it('normalizes, replaces and sorts slot pools', () => {
    expect(
      service.upsertSlot([{ level: 3, current: 1, max: 2 }], {
        level: 1,
        current: 8,
        max: 4,
        recovery: 'short-rest',
      }),
    ).toEqual([
      { level: 1, current: 4, max: 4, recovery: 'short-rest' },
      { level: 3, current: 1, max: 2 },
    ]);
  });
});
