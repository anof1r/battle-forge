import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BattleService } from '../../../core/services/battle.service';
import { CharacterService } from '../../../core/services/character.service';
import { LoggerService } from '../../../core/services/logger.service';
import { DmSpellGrantComponent } from './dm-spell-grant.component';

describe('DmSpellGrantComponent', () => {
  let component: DmSpellGrantComponent;
  let characters: {
    updatePlayerSpells: ReturnType<typeof vi.fn>;
    restorePlayerSpells: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    characters = {
      updatePlayerSpells: vi.fn().mockResolvedValue(undefined),
      restorePlayerSpells: vi.fn().mockResolvedValue(undefined),
    };
    TestBed.configureTestingModule({
      imports: [DmSpellGrantComponent],
      providers: [
        { provide: BattleService, useValue: { playersInBattle: signal({}) } },
        { provide: CharacterService, useValue: characters },
        { provide: LoggerService, useValue: { error: vi.fn() } },
      ],
    });
    component = TestBed.createComponent(DmSpellGrantComponent).componentInstance;
  });

  it('builds a complete spell and resets after persistence succeeds', async () => {
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('00000000-0000-4000-8000-000000000001');
    component.selectedPlayerId.set('player_Aria');
    component.spellName.set('  Fireball  ');
    component.spellLevel.set(3);
    component.school.set(' Evocation ');
    component.description.set(' Boom ');
    component.damageFormula.set(' 8d6 ');
    component.damageType.set(' fire ');

    component.giveSpell();

    await vi.waitFor(() =>
      expect(characters.updatePlayerSpells).toHaveBeenCalledWith('Aria', {
        id: 'spell-00000000-0000-4000-8000-000000000001',
        name: 'Fireball',
        level: 3,
        school: 'Evocation',
        description: 'Boom',
        damageFormula: '8d6',
        damageType: 'fire',
        isCantrip: false,
        isPrepared: true,
      }),
    );
    expect(component.selectedPlayerId()).toBeNull();
    expect(component.spellName()).toBe('');
  });

  it('restores spell uses for the selected player', async () => {
    component.selectedPlayerId.set('player_Aria');
    component.restoreSpells();

    await vi.waitFor(() => expect(characters.restorePlayerSpells).toHaveBeenCalledWith('Aria'));
  });
});
