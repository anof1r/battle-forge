import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ParsedCharacter } from '../../../core/models/character.model';
import { Combatant } from '../../../core/models/combatant.model';
import { BattleService } from '../../../core/services/battle.service';
import { CharacterService } from '../../../core/services/character.service';
import { LoggerService } from '../../../core/services/logger.service';
import { DmCharacterResourcesComponent } from './dm-character-resources.component';

describe('DmCharacterResourcesComponent', () => {
  let fixture: ComponentFixture<DmCharacterResourcesComponent>;
  let component: DmCharacterResourcesComponent;
  let characters: {
    loadCharacter: ReturnType<typeof vi.fn>;
    setSpellSlotPool: ReturnType<typeof vi.fn>;
    upsertResource: ReturnType<typeof vi.fn>;
    removeResource: ReturnType<typeof vi.fn>;
  };
  let logger: { error: ReturnType<typeof vi.fn> };

  const ariaCombatant: Combatant = {
    id: 'player_Aria',
    type: 'player',
    name: 'Aria',
    playerName: 'Aria',
    initiative: 10,
    ac: 14,
    maxHp: 20,
    currentHp: 20,
    status: 'alive',
  };

  const aria: ParsedCharacter = {
    name: 'Aria',
    class: 'Wizard',
    level: 3,
    race: 'Elf',
    stats: { str: 8, dex: 14, con: 12, int: 16, wis: 10, cha: 10 },
    maxHp: 20,
    currentHp: 20,
    ac: 14,
    speed: 30,
    weapons: [],
    abilities: [],
    spellSlots: [{ level: 1, current: 2, max: 4 }],
    resources: [{ id: 'arcane', name: 'Магическое восстановление', description: 'Возвращает ячейку.', current: 1, max: 1, recovery: 'long-rest' }],
  };

  beforeEach(() => {
    characters = {
      loadCharacter: vi.fn().mockResolvedValue(aria),
      setSpellSlotPool: vi.fn().mockResolvedValue(undefined),
      upsertResource: vi.fn().mockResolvedValue(undefined),
      removeResource: vi.fn().mockResolvedValue(undefined),
    };
    logger = { error: vi.fn() };
    TestBed.configureTestingModule({
      imports: [DmCharacterResourcesComponent],
      providers: [
        { provide: BattleService, useValue: { playersInBattle: signal({ player_Aria: ariaCombatant }) } },
        { provide: CharacterService, useValue: characters },
        { provide: LoggerService, useValue: logger },
      ],
    });
    fixture = TestBed.createComponent(DmCharacterResourcesComponent);
    component = fixture.componentInstance;
  });

  it('loads a selected player and safely reads sparse slot levels', async () => {
    component.selectPlayer({ target: { value: 'player_Aria' } } as unknown as Event);

    await vi.waitFor(() => expect(component.character()).toEqual(aria));
    expect(component.slotAt(1)).toMatchObject({ current: 2, max: 4 });
    expect(component.slotAt(9)).toEqual({ current: 0, max: 0 });
  });

  it('saves shared slots and generic resources for the selected character', async () => {
    component.selectPlayer({ target: { value: 'player_Aria' } } as unknown as Event);
    await vi.waitFor(() => expect(component.character()).toEqual(aria));
    component.slotLevel.set(2);
    component.slotCurrent.set(1);
    component.slotMax.set(3);

    component.saveSlot();

    await vi.waitFor(() => expect(characters.setSpellSlotPool).toHaveBeenCalledWith('Aria', {
      level: 2,
      current: 1,
      max: 3,
      recovery: 'long-rest',
    }));
    await vi.waitFor(() => expect(component.saving()).toBe(false));

    component.resourceName.set('Ярость');
    component.resourceDescription.set('Преимущество к проверкам Силы.');
    component.resourceCurrent.set(1);
    component.resourceMax.set(2);
    component.resourceRecovery.set('long-rest');
    component.saveResource();

    await vi.waitFor(() => expect(characters.upsertResource).toHaveBeenCalledWith('Aria', {
      id: '',
      name: 'Ярость',
      description: 'Преимущество к проверкам Силы.',
      isUnlimited: false,
      current: 1,
      max: 2,
      recovery: 'long-rest',
    }));
    await vi.waitFor(() => expect(component.resourceName()).toBe(''));
    expect(component.resourceDescription()).toBe('');
    expect(component.resourceUnlimited()).toBe(false);
  });

  it('configures an unlimited resource without charge or recovery fields', async () => {
    component.selectPlayer({ target: { value: 'player_Aria' } } as unknown as Event);
    await vi.waitFor(() => expect(component.character()).toEqual(aria));
    component.resourceName.set('Скрытая атака');
    component.resourceCurrent.set(4);
    component.resourceMax.set(4);

    component.setResourceUnlimited({ target: { checked: true } } as unknown as Event);

    expect(component.resourceUnlimited()).toBe(true);
    expect(component.resourceCurrent()).toBe(0);
    expect(component.resourceMax()).toBe(0);
    expect(component.resourceRecovery()).toBe('manual');
    component.saveResource();

    await vi.waitFor(() => expect(characters.upsertResource).toHaveBeenCalledWith('Aria', {
      id: '',
      name: 'Скрытая атака',
      description: '',
      isUnlimited: true,
      current: 0,
      max: 0,
      recovery: 'manual',
    }));
  });

  it('edits, fills and deletes a manual resource', async () => {
    component.selectPlayer({ target: { value: 'player_Aria' } } as unknown as Event);
    await vi.waitFor(() => expect(component.character()).toEqual(aria));
    const resource = aria.resources![0];

    component.editResource(resource);

    expect(component.resourceName()).toBe(resource.name);
    expect(component.resourceDescription()).toBe('Возвращает ячейку.');
    expect(component.resourceUnlimited()).toBe(false);
    component.resourceMax.set(4);
    component.fillResourceToMax();
    expect(component.resourceCurrent()).toBe(4);

    vi.spyOn(window, 'confirm').mockReturnValue(true);
    component.deleteResource(resource);

    await vi.waitFor(() => expect(characters.removeResource).toHaveBeenCalledWith('Aria', 'arcane'));
    await vi.waitFor(() => expect(component.saving()).toBe(false));
    expect(component.resourceId()).toBeNull();
  });

  it('keeps resource form values when persistence fails', async () => {
    const error = new Error('write failed');
    characters.upsertResource.mockRejectedValue(error);
    component.selectedPlayerId.set('player_Aria');
    component.resourceName.set('Кости превосходства');
    component.resourceCurrent.set(2);
    component.resourceMax.set(4);

    component.saveResource();

    await vi.waitFor(() => expect(component.saving()).toBe(false));
    expect(component.resourceName()).toBe('Кости превосходства');
    expect(component.resourceCurrent()).toBe(2);
    expect(component.resourceMax()).toBe(4);
    expect(component.error()).not.toBeNull();
    expect(logger.error).toHaveBeenCalledWith('DmCharacterResourcesComponent.saveResource', error);
  });
});
