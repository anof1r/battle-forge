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
          damage: '1d4+3',
          damageType: 'piercing',
          ability: 'dex',
        },
      ],
    });
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
      weapons: [],
      resistances: [],
      abilities: [],
    });
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

  it('uses the standard D&D ability modifier formula', () => {
    expect(service.getModifier(1)).toBe(-5);
    expect(service.getModifier(10)).toBe(0);
    expect(service.getModifier(11)).toBe(0);
    expect(service.getModifier(18)).toBe(4);
  });
});
