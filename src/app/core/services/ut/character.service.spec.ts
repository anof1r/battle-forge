import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ParsedCharacter } from '../../models/character.model';
import { SpellData } from '../../models/combatant.model';
import { CharacterService } from '../character.service';
import { FirebaseService } from '../firebase.service';

describe('CharacterService', () => {
  let service: CharacterService;
  let firebase: {
    get: ReturnType<typeof vi.fn>;
    set: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    subscribe: ReturnType<typeof vi.fn>;
  };

  const createCharacter = (overrides: Partial<ParsedCharacter> = {}): ParsedCharacter => ({
    name: 'Aria',
    class: 'Wizard',
    level: 5,
    race: 'Elf',
    stats: { str: 8, dex: 14, con: 12, int: 18, wis: 11, cha: 10 },
    maxHp: 30,
    currentHp: 24,
    ac: 13,
    speed: 30,
    weapons: [],
    abilities: [],
    ...overrides,
  });

  const normalizedCharacter = (character: ParsedCharacter): ParsedCharacter => ({
    ...character,
    temporaryHp: character.temporaryHp ?? 0,
    resistances: character.resistances ?? [],
    inventory: character.inventory ?? [],
    spells: character.spells ?? [],
    spellSlots: character.spellSlots ?? [],
    resources: character.resources ?? [],
  });

  const createSpell = (overrides: Partial<SpellData> = {}): SpellData => ({
    id: 'spell-1',
    name: 'Fire Bolt',
    level: 0,
    isCantrip: true,
    isPrepared: true,
    damageFormula: '1d10',
    ...overrides,
  });

  beforeEach(() => {
    firebase = {
      get: vi.fn(),
      set: vi.fn().mockResolvedValue(undefined),
      update: vi.fn().mockResolvedValue(undefined),
      subscribe: vi.fn(),
    };
    TestBed.configureTestingModule({
      providers: [
        CharacterService,
        { provide: FirebaseService, useValue: firebase },
      ],
    });
    service = TestBed.inject(CharacterService);
  });

  it('uses the player path for existence checks, loading and subscriptions', async () => {
    const character = createCharacter();
    firebase.get.mockResolvedValueOnce(character).mockResolvedValueOnce(character);
    firebase.subscribe.mockReturnValue(of(character));

    await expect(service.characterExists('Aria')).resolves.toBe(true);
    await expect(service.loadCharacter('Aria')).resolves.toEqual(normalizedCharacter(character));

    const values: Array<ParsedCharacter | null> = [];
    service.subscribeToCharacter('Aria').subscribe((value) => values.push(value));

    expect(firebase.get).toHaveBeenNthCalledWith(1, 'players/Aria');
    expect(firebase.get).toHaveBeenNthCalledWith(2, 'players/Aria');
    expect(firebase.subscribe).toHaveBeenCalledWith('players/Aria');
    expect(values).toEqual([normalizedCharacter(character)]);
  });

  it('returns false and null when a character does not exist', async () => {
    firebase.get.mockResolvedValue(null);

    await expect(service.characterExists('Missing')).resolves.toBe(false);
    await expect(service.loadCharacter('Missing')).resolves.toBeNull();
  });

  it('normalizes malformed optional Firebase fields without rejecting the character', async () => {
    firebase.get.mockResolvedValue({
      ...createCharacter(),
      currentHp: 999,
      temporaryHp: -5,
      weapons: null,
      spells: { legacy: true },
      spellSlots: [
        { level: 1, current: 9, max: 4 },
        { level: 12, current: 1, max: 1 },
        null,
      ],
      resources: [
        { id: 'rage', name: 'Ярость', description: '  Бонусный урон  ', current: 10, max: 2, recovery: 'unknown' },
        { id: 'broken' },
      ],
    });

    await expect(service.loadCharacter('Aria')).resolves.toEqual(expect.objectContaining({
      currentHp: 30,
      temporaryHp: 0,
      weapons: [],
      spells: [],
      spellSlots: [{ level: 1, current: 4, max: 4 }],
      resources: [{ id: 'rage', name: 'Ярость', description: 'Бонусный урон', current: 2, max: 2, recovery: 'manual' }],
    }));
  });

  it('migrates legacy weapon abilities into Russian damage formulas', async () => {
    firebase.get.mockResolvedValue({
      ...createCharacter(),
      weapons: [
        { name: 'Dagger', damage: '1d4', damageType: 'piercing', ability: 'dex' },
        { name: 'Warhammer', damage: '1d8 + STR', damageType: 'bludgeoning' },
      ],
    });

    const loaded = await service.loadCharacter('Aria');

    expect(loaded?.weapons).toEqual([
      { name: 'Dagger', damage: '1d4 + ЛОВ', damageType: 'piercing' },
      { name: 'Warhammer', damage: '1d8 + СИЛ', damageType: 'bludgeoning' },
    ]);
    expect(loaded?.weapons.some((weapon) => 'ability' in weapon)).toBe(false);
  });

  it('saves a character with a fresh timestamp without changing the input', async () => {
    const character = createCharacter();
    vi.spyOn(Date, 'now').mockReturnValue(4321);

    await service.saveCharacter(character);

    expect(firebase.set).toHaveBeenCalledWith('players/Aria', {
      ...normalizedCharacter(character),
      lastUpdated: 4321,
    });
    expect(character).not.toHaveProperty('lastUpdated');
  });

  it('returns all stored players and handles an empty collection', async () => {
    const aria = createCharacter();
    const borin = createCharacter({ name: 'Borin' });
    firebase.get.mockResolvedValueOnce({ aria, borin }).mockResolvedValueOnce(null);

    await expect(service.getAllPlayers()).resolves.toEqual([
      normalizedCharacter(aria),
      normalizedCharacter(borin),
    ]);
    await expect(service.getAllPlayers()).resolves.toEqual([]);
    expect(firebase.get).toHaveBeenCalledWith('players');
  });

  it('clamps persisted player HP at zero', async () => {
    await service.updatePlayerHp('Aria', -12);

    expect(firebase.set).toHaveBeenCalledWith('players/Aria/currentHp', 0);
  });

  it('atomically persists regular and temporary HP', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(9000);

    await service.updatePlayerHealth('Aria', -2, 7.9);

    expect(firebase.update).toHaveBeenCalledWith('players/Aria', {
      currentHp: 0,
      temporaryHp: 7,
      lastUpdated: 9000,
    });
  });

  it('adds a new spell and merges an update into an existing spell', async () => {
    const existing = createSpell();
    const character = createCharacter({ spells: [existing] });
    vi.spyOn(service, 'loadCharacter').mockResolvedValue(character);
    const save = vi.spyOn(service, 'saveCharacter').mockResolvedValue(undefined);

    await service.updatePlayerSpells('Aria', createSpell({ id: 'replacement', damageFormula: '2d10' }));

    expect(save).toHaveBeenLastCalledWith(
      expect.objectContaining({
        spells: [
          expect.objectContaining({
            id: 'replacement',
            name: 'Fire Bolt',
            damageFormula: '2d10',
          }),
        ],
      }),
    );

    await service.updatePlayerSpells('Aria', createSpell({ id: 'spell-2', name: 'Shield' }));
    expect(save).toHaveBeenLastCalledWith(
      expect.objectContaining({
        spells: [
          expect.objectContaining({ name: 'Fire Bolt' }),
          expect.objectContaining({ name: 'Shield' }),
        ],
      }),
    );
  });

  it('removes a spell by id and ignores updates for a missing player', async () => {
    const character = createCharacter({
      spells: [createSpell(), createSpell({ id: 'spell-2', name: 'Shield' })],
    });
    const load = vi
      .spyOn(service, 'loadCharacter')
      .mockResolvedValueOnce(character)
      .mockResolvedValueOnce(null);
    const save = vi.spyOn(service, 'saveCharacter').mockResolvedValue(undefined);

    await service.removePlayerSpell('Aria', 'spell-1');
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({ spells: [expect.objectContaining({ id: 'spell-2' })] }),
    );

    await service.updatePlayerSpells('Missing', createSpell());
    expect(load).toHaveBeenLastCalledWith('Missing');
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('spends one use of a leveled spell and normalizes legacy spell data', async () => {
    const spell = createSpell({
      id: 'spell-shield',
      name: 'Shield',
      level: 1,
      isCantrip: false,
    });
    vi.spyOn(service, 'loadCharacter').mockResolvedValue(createCharacter({ spells: [spell] }));
    const save = vi.spyOn(service, 'saveCharacter').mockResolvedValue(undefined);

    await expect(service.usePlayerSpell('Aria', spell.id)).resolves.toBe(true);

    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({
        spells: [expect.objectContaining({ id: spell.id, maxUses: 1, usesRemaining: 0 })],
      }),
    );
  });

  it('does not spend exhausted, unprepared, missing, or cantrip resources', async () => {
    const exhausted = createSpell({
      id: 'exhausted',
      level: 1,
      isCantrip: false,
      maxUses: 2,
      usesRemaining: 0,
    });
    const unprepared = createSpell({ id: 'unprepared', isPrepared: false });
    const cantrip = createSpell({ id: 'cantrip' });
    vi.spyOn(service, 'loadCharacter')
      .mockResolvedValueOnce(createCharacter({ spells: [exhausted] }))
      .mockResolvedValueOnce(createCharacter({ spells: [unprepared] }))
      .mockResolvedValueOnce(createCharacter({ spells: [cantrip] }))
      .mockResolvedValueOnce(null);
    const save = vi.spyOn(service, 'saveCharacter').mockResolvedValue(undefined);

    await expect(service.usePlayerSpell('Aria', exhausted.id)).resolves.toBe(false);
    await expect(service.usePlayerSpell('Aria', unprepared.id)).resolves.toBe(false);
    await expect(service.usePlayerSpell('Aria', cantrip.id)).resolves.toBe(true);
    await expect(service.usePlayerSpell('Missing', 'missing')).resolves.toBe(false);

    expect(save).not.toHaveBeenCalled();
  });

  it('restores leveled spell uses while leaving cantrips unchanged', async () => {
    const cantrip = createSpell({ id: 'cantrip' });
    const leveled = createSpell({
      id: 'leveled',
      level: 2,
      isCantrip: false,
      maxUses: 3,
      usesRemaining: 0,
    });
    const legacy = createSpell({ id: 'legacy', level: 1, isCantrip: false });
    vi.spyOn(service, 'loadCharacter').mockResolvedValue(
      createCharacter({ spells: [cantrip, leveled, legacy] }),
    );
    const save = vi.spyOn(service, 'saveCharacter').mockResolvedValue(undefined);

    await service.restorePlayerSpells('Aria');

    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({
        spells: [
          cantrip,
          expect.objectContaining({ id: 'leveled', maxUses: 3, usesRemaining: 3 }),
          expect.objectContaining({ id: 'legacy', maxUses: 1, usesRemaining: 1 }),
        ],
      }),
    );
  });

  it('restores HP and leveled spell uses during a long rest', async () => {
    const leveled = createSpell({
      id: 'shield',
      level: 1,
      isCantrip: false,
      maxUses: 3,
      usesRemaining: 0,
    });
    vi.spyOn(service, 'loadCharacter').mockResolvedValue(
      createCharacter({ currentHp: 2, spells: [leveled] }),
    );
    const save = vi.spyOn(service, 'saveCharacter').mockResolvedValue(undefined);

    await service.completeLongRest('Aria', 30);

    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({
        currentHp: 30,
        spells: [expect.objectContaining({ id: 'shield', usesRemaining: 3 })],
      }),
    );
  });

  it('spends a shared slot of the selected level and leaves spell counters untouched', async () => {
    const spell = createSpell({ id: 'burning-hands', level: 1, isCantrip: false });
    vi.spyOn(service, 'loadCharacter').mockResolvedValue(
      createCharacter({
        spells: [spell],
        spellSlots: [
          { level: 1, current: 0, max: 2 },
          { level: 2, current: 1, max: 1 },
        ],
      }),
    );
    const save = vi.spyOn(service, 'saveCharacter').mockResolvedValue(undefined);

    await expect(service.usePlayerSpell('Aria', spell.id, 2)).resolves.toBe(true);

    expect(save).toHaveBeenCalledWith(expect.objectContaining({
      spells: [spell],
      spellSlots: [
        { level: 1, current: 0, max: 2 },
        { level: 2, current: 0, max: 1 },
      ],
    }));
  });

  it('saves resource descriptions and removes a selected manual resource', async () => {
    const character = createCharacter({
      resources: [
        { id: 'rage', name: 'Ярость', current: 2, max: 2, recovery: 'long-rest' },
        { id: 'ki', name: 'Ци', current: 1, max: 3, recovery: 'short-rest' },
      ],
    });
    vi.spyOn(service, 'loadCharacter').mockResolvedValue(character);
    const save = vi.spyOn(service, 'saveCharacter').mockResolvedValue(undefined);

    await service.upsertResource('Aria', {
      id: 'rage',
      name: ' Ярость ',
      description: '  Даёт преимущество к проверке Силы. ',
      current: 1,
      max: 2,
      recovery: 'long-rest',
    });

    expect(save).toHaveBeenLastCalledWith(expect.objectContaining({
      resources: [
        {
          id: 'rage',
          name: 'Ярость',
          description: 'Даёт преимущество к проверке Силы.',
          current: 1,
          max: 2,
          recovery: 'long-rest',
        },
        expect.objectContaining({ id: 'ki' }),
      ],
    }));

    await service.removeResource('Aria', 'rage');

    expect(save).toHaveBeenLastCalledWith(expect.objectContaining({
      resources: [expect.objectContaining({ id: 'ki' })],
    }));
  });

  it('restores only matching resources on a short rest', async () => {
    vi.spyOn(service, 'loadCharacter').mockResolvedValue(createCharacter({
      spellSlots: [
        { level: 1, current: 0, max: 2, recovery: 'short-rest' },
        { level: 2, current: 0, max: 1 },
      ],
      resources: [
        { id: 'rage', name: 'Ярость', current: 0, max: 2, recovery: 'long-rest' },
        { id: 'ki', name: 'Ци', current: 0, max: 3, recovery: 'short-rest' },
        { id: 'manual', name: 'Особый заряд', current: 0, max: 1, recovery: 'manual' },
      ],
    }));
    const save = vi.spyOn(service, 'saveCharacter').mockResolvedValue(undefined);

    await service.completeShortRest('Aria');

    expect(save).toHaveBeenCalledWith(expect.objectContaining({
      spellSlots: [
        { level: 1, current: 2, max: 2, recovery: 'short-rest' },
        { level: 2, current: 0, max: 1 },
      ],
      resources: [
        expect.objectContaining({ id: 'rage', current: 0 }),
        expect.objectContaining({ id: 'ki', current: 3 }),
        expect.objectContaining({ id: 'manual', current: 0 }),
      ],
    }));
  });
});
