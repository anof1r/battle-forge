import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { COMBATANT_STATUS, COMBATANT_TYPE } from '../../../core/constants/combatant.constants';
import { Open5eSpell } from '../../../core/models';
import { BattleService } from '../../../core/services/battle.service';
import { CharacterService } from '../../../core/services/character.service';
import { EnemyActionLibraryService } from '../../../core/services/enemy-action-library.service';
import { LoggerService } from '../../../core/services/logger.service';
import { Open5eService } from '../../../core/services/open5e.service';
import { SceneLibraryService } from '../../../core/services/scene-library.service';
import { SpellLibraryService } from '../../../core/services/spell-library.service';
import { DmOpen5eImportComponent } from './dm-open5e-import.component';

describe('DmOpen5eImportComponent', () => {
  let fixture: ComponentFixture<DmOpen5eImportComponent>;
  let component: DmOpen5eImportComponent;
  let open5e: {
    searchSpells: ReturnType<typeof vi.fn>;
    searchWeapons: ReturnType<typeof vi.fn>;
    searchCreatures: ReturnType<typeof vi.fn>;
  };
  let spellLibrary: { spells: ReturnType<typeof signal<never[]>>; saveSpell: ReturnType<typeof vi.fn> };
  let character: { updatePlayerSpells: ReturnType<typeof vi.fn> };

  const magicMissile: Open5eSpell = {
    kind: 'spell',
    key: 'magic-missile',
    name: 'Magic Missile',
    description: 'Three glowing darts strike targets.',
    document: { key: 'srd-2024', name: 'SRD 2024', permalink: '' },
    level: 1,
    school: 'Evocation',
    higherLevel: 'One extra dart.',
    damageFormula: '3d4 + 3',
    damageTypes: ['Force'],
    castingTime: 'action',
    range: '120 feet',
    duration: 'instantaneous',
    components: 'V, S',
    ritual: false,
    concentration: false,
  };

  beforeEach(() => {
    open5e = {
      searchSpells: vi.fn().mockReturnValue(of([magicMissile])),
      searchWeapons: vi.fn().mockReturnValue(of([])),
      searchCreatures: vi.fn().mockReturnValue(of([])),
    };
    spellLibrary = { spells: signal([]), saveSpell: vi.fn().mockResolvedValue('spell-id') };
    character = { updatePlayerSpells: vi.fn().mockResolvedValue(undefined) };

    TestBed.configureTestingModule({
      imports: [DmOpen5eImportComponent],
      providers: [
        { provide: Open5eService, useValue: open5e },
        { provide: SpellLibraryService, useValue: spellLibrary },
        {
          provide: EnemyActionLibraryService,
          useValue: { actions: signal([]), saveAction: vi.fn().mockResolvedValue('action-id') },
        },
        {
          provide: SceneLibraryService,
          useValue: { creatures: signal([]), saveCreature: vi.fn().mockResolvedValue('creature-id') },
        },
        { provide: CharacterService, useValue: character },
        {
          provide: BattleService,
          useValue: {
            playersInBattle: signal({
              player_robin: {
                id: 'player_robin',
                playerName: 'robin',
                name: 'Робин',
                type: COMBATANT_TYPE.PLAYER,
                status: COMBATANT_STATUS.ALIVE,
                initiative: 10,
                ac: 14,
                maxHp: 10,
                currentHp: 10,
              },
            }),
          },
        },
        { provide: LoggerService, useValue: { error: vi.fn() } },
      ],
    });
    fixture = TestBed.createComponent(DmOpen5eImportComponent);
    component = fixture.componentInstance;
  });

  it('searches the selected Open5e collection and keeps the source filter', async () => {
    component.query.set('Magic Missile');
    component.search();

    await vi.waitFor(() => expect(component.results()).toEqual([magicMissile]));
    expect(open5e.searchSpells).toHaveBeenCalledWith('Magic Missile', 'srd-2024');
  });

  it('saves a translated snapshot and gives it to the selected player', async () => {
    component.selectEntry(magicMissile);
    component.spellName.set('Волшебная стрела');
    component.spellDescription.set('Три магических дротика поражают цели.');
    component.selectedPlayerId.set('player_robin');

    component.saveAndGiveSpell();

    await vi.waitFor(() => expect(character.updatePlayerSpells).toHaveBeenCalled());
    expect(spellLibrary.saveSpell).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'spell_open5e_srd-2024_magic-missile',
        name: 'Волшебная стрела',
        source: expect.objectContaining({ originalName: 'Magic Missile' }),
      }),
    );
    expect(character.updatePlayerSpells).toHaveBeenCalledWith(
      'robin',
      expect.objectContaining({
        librarySpellId: 'spell_open5e_srd-2024_magic-missile',
        name: 'Волшебная стрела',
        isPrepared: true,
      }),
    );
    expect(component.feedback()).toContain('сохранено и выдано');
  });
});
