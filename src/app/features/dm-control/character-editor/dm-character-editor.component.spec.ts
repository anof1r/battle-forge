import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ParsedCharacter } from '../../../core/models/character.model';
import { BattleService } from '../../../core/services/battle.service';
import {
  CharacterNameConflictError,
  CharacterService,
} from '../../../core/services/character.service';
import { LoggerService } from '../../../core/services/logger.service';
import { DmCharacterEditorComponent } from './dm-character-editor.component';

describe('DmCharacterEditorComponent', () => {
  let fixture: ComponentFixture<DmCharacterEditorComponent>;
  let component: DmCharacterEditorComponent;
  let characters: {
    getAllPlayers: ReturnType<typeof vi.fn>;
    updateCharacter: ReturnType<typeof vi.fn>;
  };
  let battle: { syncPlayerCharacter: ReturnType<typeof vi.fn> };
  let logger: { error: ReturnType<typeof vi.fn> };

  const aria: ParsedCharacter = {
    name: 'Aria',
    class: 'Wizard',
    level: 5,
    race: 'Elf',
    stats: { str: 8, dex: 14, con: 12, int: 18, wis: 11, cha: 10 },
    proficiencyBonus: 3,
    savingThrows: [
      { stat: 'str', proficient: false, modifier: -1 },
      { stat: 'dex', proficient: false, modifier: 2 },
      { stat: 'con', proficient: false, modifier: 1 },
      { stat: 'int', proficient: true, modifier: 7 },
      { stat: 'wis', proficient: true, modifier: 3 },
      { stat: 'cha', proficient: false, modifier: 0 },
    ],
    maxHp: 30,
    currentHp: 24,
    temporaryHp: 2,
    ac: 13,
    speed: 30,
    weapons: [{ name: 'Dagger', damage: '1d4 + ЛОВ', damageType: 'piercing' }],
    inventory: [
      {
        id: 'potion',
        name: 'Potion',
        quantity: 2,
        description: '',
        isStackable: true,
        isConsumable: true,
      },
    ],
    abilities: [{ name: 'Darkvision', description: 'See in darkness' }],
    skills: [
      { id: 'arcana', name: 'Магия', baseStat: 'int', proficiency: 'proficient', modifier: 7 },
    ],
  };

  beforeEach(async () => {
    characters = {
      getAllPlayers: vi.fn().mockResolvedValue([aria]),
      updateCharacter: vi.fn(
        async (_originalName: string, character: ParsedCharacter) => character,
      ),
    };
    battle = { syncPlayerCharacter: vi.fn().mockResolvedValue(undefined) };
    logger = { error: vi.fn() };

    TestBed.configureTestingModule({
      imports: [DmCharacterEditorComponent],
      providers: [
        { provide: CharacterService, useValue: characters },
        { provide: BattleService, useValue: battle },
        { provide: LoggerService, useValue: logger },
      ],
    });
    fixture = TestBed.createComponent(DmCharacterEditorComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('loads all saved heroes and opens every editable statistics section', () => {
    expect(characters.getAllPlayers).toHaveBeenCalledOnce();
    expect(fixture.nativeElement.querySelector('.character-editor__player')).toHaveTextContent(
      'Aria',
    );

    (fixture.nativeElement as HTMLElement)
      .querySelector<HTMLButtonElement>('.character-editor__player')!
      .click();
    fixture.detectChanges();

    expect(component.draft()?.savingThrows).toHaveLength(6);
    expect(component.draft()?.skills).toHaveLength(18);
    expect(
      fixture.nativeElement.querySelectorAll('.character-editor__ability-grid input'),
    ).toHaveLength(6);
    expect(fixture.nativeElement.querySelectorAll('.character-editor__save-row')).toHaveLength(6);
    expect(fixture.nativeElement.querySelectorAll('.character-editor__skill-row')).toHaveLength(19);
  });

  it('renames and updates statistics while preserving the rest of the character aggregate', async () => {
    component.selectPlayer('Aria');
    component.setText('name', { target: { value: 'Luna' } } as unknown as Event);
    component.setCoreNumber('ac', { target: { value: '18' } } as unknown as Event);
    component.setCoreNumber('maxHp', { target: { value: '40' } } as unknown as Event);
    component.setCoreNumber('proficiencyBonus', { target: { value: '4' } } as unknown as Event);
    component.setStat('int', { target: { value: '20' } } as unknown as Event);
    component.setSkillProficiency('arcana', {
      target: { value: 'expertise' },
    } as unknown as Event);
    component.recalculateDerivedBonuses();

    await component.saveCharacter();

    expect(characters.updateCharacter).toHaveBeenCalledWith(
      'Aria',
      expect.objectContaining({
        name: 'Luna',
        ac: 18,
        maxHp: 40,
        proficiencyBonus: 4,
        stats: expect.objectContaining({ int: 20 }),
        inventory: aria.inventory,
        weapons: aria.weapons,
        abilities: aria.abilities,
        skills: expect.arrayContaining([
          expect.objectContaining({ id: 'arcana', proficiency: 'expertise', modifier: 13 }),
        ]),
      }),
    );
    const savedCharacter = characters.updateCharacter.mock.calls[0][1] as ParsedCharacter;
    expect(savedCharacter.skills).toHaveLength(18);
    expect(savedCharacter.skills).toContainEqual(
      expect.objectContaining({ id: 'acrobatics', proficiency: 'none' }),
    );
    expect(battle.syncPlayerCharacter).toHaveBeenCalledWith(
      'Aria',
      expect.objectContaining({ name: 'Luna', ac: 18 }),
    );
    expect(component.selectedPlayerName()).toBe('Luna');
    expect(component.feedback()).toBeTruthy();
  });

  it('keeps the draft and reports a duplicate name without touching the battle', async () => {
    characters.updateCharacter.mockRejectedValueOnce(new CharacterNameConflictError('duplicate'));
    component.selectPlayer('Aria');
    component.setText('name', { target: { value: 'Borin' } } as unknown as Event);

    await component.saveCharacter();

    expect(component.draft()?.name).toBe('Borin');
    expect(component.error()).toBeTruthy();
    expect(battle.syncPlayerCharacter).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith(
      'DmCharacterEditorComponent.saveCharacter',
      expect.any(CharacterNameConflictError),
    );
  });
});
