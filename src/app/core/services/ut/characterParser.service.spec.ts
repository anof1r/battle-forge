import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LssCharacterData, LssCharacterSheet } from '../../models/character.model';
import { CharacterParserService } from '../characterParser.service';
import { LoggerService } from '../logger.service';

describe('CharacterParserService', () => {
  let service: CharacterParserService;
  let logger: { error: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    logger = { error: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        CharacterParserService,
        { provide: LoggerService, useValue: logger },
      ],
    });
    service = TestBed.inject(CharacterParserService);
  });

  it('normalizes core character data and calculates formula-based AC', () => {
    const data: LssCharacterData = {
      name: { value: 'Aria' },
      info: {
        charClass: { value: 'Wizard' },
        level: { value: 5 },
        race: { value: 'Elf' },
      },
      stats: { str: { score: 8 }, dex: { score: 16 }, int: { score: 18 } },
      vitality: {
        'hp-max': { value: 32 },
        'hp-current': { value: 21 },
        speed: { value: 35 },
        ac: { value: '10 + [DEX]' },
      },
      weaponsList: [
        {
          name: { value: 'Dagger' },
          dmg: { value: '1d4+3' },
          dmgType: { value: 'piercing' },
          ability: 'dex',
        },
      ],
    };

    expect(service.parseCharacter({ data })).toMatchObject({
      name: 'Aria',
      class: 'Wizard',
      level: 5,
      race: 'Elf',
      stats: { str: 8, dex: 16, con: 10, int: 18, wis: 10, cha: 10 },
      maxHp: 32,
      currentHp: 21,
      speed: 35,
      ac: 13,
      weapons: [
        {
          name: 'Dagger',
          damage: '1d4+3 + ЛОВ',
          damageType: 'piercing',
        },
      ],
    });
  });

  it('adds the Constitution modifier for every character level to maximum HP', () => {
    const parsed = service.parseCharacter({
      data: {
        info: { level: { value: 3 } },
        stats: { con: { score: 14 } },
        vitality: { 'hp-max': { value: 18 } },
      },
    });

    expect(parsed.maxHp).toBe(24);
    expect(parsed.currentHp).toBe(24);
  });

  it('preserves explicitly tracked current HP when applying the Constitution maximum bonus', () => {
    const parsed = service.parseCharacter({
      data: {
        info: { level: { value: 2 } },
        stats: { con: { score: 16 } },
        vitality: {
          'hp-max': { value: 14 },
          'hp-current': { value: 7 },
        },
      },
    });

    expect(parsed.maxHp).toBe(20);
    expect(parsed.currentHp).toBe(7);
  });

  it('accepts a string payload and applies stable defaults for missing fields', () => {
    const sheet: LssCharacterSheet = { data: JSON.stringify({}) };

    expect(service.parseCharacter(sheet)).toEqual({
      name: 'Неизвестный',
      class: 'Неизвестно',
      level: 1,
      race: 'Неизвестно',
      stats: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
      maxHp: 10,
      currentHp: 10,
      ac: 10,
      speed: 30,
      temporaryHp: 0,
      weapons: [],
      resistances: [],
      abilities: [],
      spellSlots: [],
      resources: [],
    });
  });

  it('moves the weapon ability into a Russian damage formula', () => {
    const parsed = service.parseCharacter({
      data: {
        weaponsList: [
          { name: { value: 'Кокалка' }, dmgType: { value: 'Дробящий' } },
          { name: { value: 'Кинжал' }, ability: '[DEX]' },
          { name: { value: 'Боевой молот' }, dmg: { value: '1d8 + STR' } },
        ],
      },
    });

    expect(parsed.weapons).toEqual([
      { name: 'Кокалка', damage: '1d4 + СИЛ', damageType: 'Дробящий' },
      { name: 'Кинжал', damage: '1d4 + ЛОВ', damageType: 'дробящий' },
      { name: 'Боевой молот', damage: '1d8 + СИЛ', damageType: 'дробящий' },
    ]);
  });

  it('ignores opaque top-level LSS spell ids and does not create spell charge resources', () => {
    const parsed = service.parseCharacter({
      data: {
        resources: {
          'resource:spell-fixed:opaque-id': {
            id: 'resource:spell-fixed:opaque-id',
            name: 'Пылающие руки [Burning Hands]',
            current: 1,
            max: 1,
            isLongRest: true,
          },
        },
      },
      spells: {
        granted: [{ id: 'opaque-id', source: 'srd-2024:sage' }],
      },
    });

    expect(parsed.spells).toBeUndefined();
    expect(parsed.resources).toEqual([]);
    expect(JSON.stringify(parsed)).not.toContain('librarySpellId');
  });

  it('leaves all LSS counters untracked while keeping their notes as abilities', () => {
    const data = {
      resources: {
        ki: { name: 'Ци', current: { value: 2 }, max: { value: 5 }, recovery: 'short rest' },
        rage: { name: 'Ярость', value: 99, max: 3, recovery: 'long rest' },
        note: { name: 'Текстовая заметка', notes: 'Не является счётчиком' },
        broken: { name: 'Повреждённый ресурс', current: 'много', max: 'три' },
      },
    } as unknown as LssCharacterData;

    const parsed = service.parseCharacter({ data });

    expect(parsed.resources).toEqual([]);
    expect(parsed.abilities).toContainEqual({
      name: 'Текстовая заметка',
      description: 'Не является счётчиком',
      source: 'resource',
    });
  });

  it('creates 2024 spell slots automatically for full and half casters', () => {
    const wizard = service.parseCharacter({
      data: {
        info: { charClass: { value: 'Волшебник' }, level: { value: 5 } },
      },
    });
    const paladin = service.parseCharacter({
      data: {
        info: { charClass: { value: 'Paladin' }, level: { value: 1 } },
      },
    });

    expect(wizard.spellSlots).toEqual([
      { level: 1, current: 4, max: 4 },
      { level: 2, current: 3, max: 3 },
      { level: 3, current: 2, max: 2 },
    ]);
    expect(paladin.spellSlots).toEqual([{ level: 1, current: 2, max: 2 }]);
  });

  it('creates short-rest Pact Magic slots for a warlock', () => {
    const warlock = service.parseCharacter({
      data: {
        info: { charClass: { value: 'Колдун' }, level: { value: 5 } },
      },
    });

    expect(warlock.spellSlots).toEqual([
      { level: 3, current: 2, max: 2, recovery: 'short-rest' },
    ]);
  });

  it('does not invent slots for non-casters, unknown classes, or multiclass labels', () => {
    const monk = service.parseCharacter({
      data: { info: { charClass: { value: 'Монах' }, level: { value: 5 } } },
    });
    const multiclass = service.parseCharacter({
      data: { info: { charClass: { value: 'Wizard / Fighter' }, level: { value: 5 } } },
    });

    expect(monk.spellSlots).toEqual([]);
    expect(multiclass.spellSlots).toEqual([]);
  });

  it('extracts resources, nested traits and feats while removing duplicate abilities', () => {
    const spoiler = (name: string, description: string) => ({
      type: 'spoiler',
      content: [
        { type: 'spoilerSummary', content: [{ type: 'text', text: name }] },
        {
          type: 'spoilerContent',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: description }] }],
        },
      ],
    });
    const data: LssCharacterData = {
      resources: {
        resistance: { name: 'Сопротивление огню', notes: 'Половина урона' },
        deleted: { name: 'Удалено', notes: 'Не показывать', isDeleted: true },
      },
      text: {
        traits: { value: { data: { content: [spoiler('Darkvision', 'See in darkness')] } } },
        feats: {
          value: {
            data: {
              content: [
                spoiler('Darkvision', 'Duplicate'),
                spoiler('Alert', 'Cannot be surprised'),
              ],
            },
          },
        },
      },
    };

    const parsed = service.parseCharacter({ data });

    expect(parsed.resistances).toEqual(['Сопротивление огню']);
    expect(parsed.abilities).toEqual([
      {
        name: 'Сопротивление огню',
        description: 'Половина урона',
        source: 'resource',
      },
      { name: 'Darkvision', description: 'See in darkness' },
      { name: 'Alert', description: 'Cannot be surprised', source: 'feat' },
    ]);
  });

  it('uses formula labels instead of formulas for LSS ability names', () => {
    const formulaSpoiler = (label: string, formula: string, description: string) => ({
      type: 'spoiler',
      content: [
        {
          type: 'spoilerSummary',
          content: [{ type: 'formula', attrs: { formula, label } }],
        },
        {
          type: 'spoilerContent',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: description }] }],
        },
      ],
    });
    const data: LssCharacterData = {
      text: {
        traits: {
          value: {
            data: {
              content: [
                formulaSpoiler(
                  'Боевые искусства',
                  '1d(((floor(([LVL]+1)/6))*2)+4)',
                  'Используйте кость боевых искусств.',
                ),
                formulaSpoiler(
                  'Скрытая атака',
                  '(ceil([LVL]/2))d6',
                  'Нанесите дополнительный урон.',
                ),
              ],
            },
          },
        },
      },
    };

    const parsed = service.parseCharacter({ data });

    expect(parsed.abilities).toEqual([
      {
        name: 'Боевые искусства',
        description: 'Используйте кость боевых искусств.',
      },
      {
        name: 'Скрытая атака',
        description: 'Нанесите дополнительный урон.',
      },
    ]);
    expect(parsed.abilities.map((ability) => ability.name).join(' ')).not.toContain('[LVL]');
  });

  it('logs malformed string data and falls back to the top-level payload', () => {
    const malformed = {
      data: '{not-json',
      name: { value: 'Fallback Hero' },
      vitality: { ac: { value: 15 } },
    } as unknown as LssCharacterSheet;

    expect(service.parseCharacter(malformed)).toMatchObject({
      name: 'Fallback Hero',
      ac: 15,
    });
    expect(logger.error).toHaveBeenCalledWith(
      'CharacterParserService.parseCharacter',
      expect.any(SyntaxError),
    );
  });

  it('recovers a trailing comma inside the string-encoded LSS data', () => {
    const sheet: LssCharacterSheet = {
      data: '{"name":{"value":"Квольхраф"},"info":{"level":{"value":1},},}',
    };

    expect(service.parseCharacter(sheet)).toMatchObject({
      name: 'Квольхраф',
      level: 1,
    });
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('uses the standard D&D ability modifier formula', () => {
    expect(service.getModifier(1)).toBe(-5);
    expect(service.getModifier(10)).toBe(0);
    expect(service.getModifier(11)).toBe(0);
    expect(service.getModifier(18)).toBe(4);
  });
});
