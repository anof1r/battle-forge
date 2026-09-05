import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BATTLE_STATUS } from '../../core/constants/battle-status.constants';
import { BattleService } from '../../core/services/battle.service';
import { CharacterService } from '../../core/services/character.service';
import { InventoryService } from '../../core/services/inventory.service';
import { ItemLibraryService } from './item-library/item-library.service';
import { LoggerService } from '../../core/services/logger.service';
import { SceneLibraryService } from './scene-library/scene-library.service';
import { StoryPresentationService } from '../../core/services/story-presentation.service';
import { RealtimeDataService } from '../../core/services/realtime-data.service';
import { DmControlComponent } from './dm-control.component';

describe('DmControlComponent', () => {
  let fixture: ComponentFixture<DmControlComponent>;
  let component: DmControlComponent;

  beforeEach(() => {
    const battle = {
      battleStatus: signal(BATTLE_STATUS.PREPARATION),
      currentRound: signal(1),
      currentCombatant: signal(null),
      aliveEnemies: signal([]),
      playersInBattle: signal({}),
      sortedCombatants: signal([]),
      combatants: signal({}),
      enemies: signal({}),
      history: signal([]),
      canUndo: signal(false),
      syncPlayersToBattle: vi.fn().mockResolvedValue(undefined),
      removePlayerFromBattle: vi.fn().mockResolvedValue(undefined),
      removeEnemy: vi.fn().mockResolvedValue(undefined),
      setCurrentTurn: vi.fn().mockResolvedValue(true),
      moveCombatant: vi.fn().mockResolvedValue(true),
      recordDeathSave: vi.fn().mockResolvedValue(true),
      revive: vi.fn().mockResolvedValue(true),
      damageAll: vi.fn().mockResolvedValue(undefined),
      damageMany: vi.fn().mockResolvedValue(undefined),
      takeDamage: vi.fn().mockResolvedValue(undefined),
      healMany: vi.fn().mockResolvedValue(undefined),
      heal: vi.fn().mockResolvedValue(undefined),
      setTemporaryHp: vi.fn().mockResolvedValue(undefined),
      addStatusEffect: vi.fn().mockResolvedValue(true),
      removeStatusEffect: vi.fn().mockResolvedValue(true),
      setInitiative: vi.fn().mockResolvedValue(undefined),
      rollInitiative: vi.fn().mockResolvedValue(undefined),
      startBattle: vi.fn().mockResolvedValue(undefined),
      nextTurn: vi.fn().mockResolvedValue(undefined),
      undoLastAction: vi.fn().mockResolvedValue(undefined),
      finishScene: vi.fn().mockResolvedValue(undefined),
      resetScene: vi.fn().mockResolvedValue(undefined),
    };
    const story = {
      mode: signal<'battle' | 'story'>('battle'),
      slides: signal([]),
      activeSlide: signal(null),
      activeSlideIndex: signal(-1),
      canShowStory: signal(false),
      canGoPrevious: signal(false),
      canGoNext: signal(false),
      setMode: vi.fn(),
      previousSlide: vi.fn(),
      nextSlide: vi.fn(),
    };
    const characterService = {
      getAllPlayers: vi.fn().mockResolvedValue([]),
      loadCharacter: vi.fn().mockResolvedValue(null),
      updatePlayerSpells: vi.fn().mockResolvedValue(undefined),
      restorePlayerSpells: vi.fn().mockResolvedValue(undefined),
      setSpellSlotPool: vi.fn().mockResolvedValue(undefined),
      upsertResource: vi.fn().mockResolvedValue(undefined),
    };

    TestBed.configureTestingModule({
      imports: [DmControlComponent],
      providers: [
        { provide: BattleService, useValue: battle },
        { provide: CharacterService, useValue: characterService },
        { provide: InventoryService, useValue: { giveItem: vi.fn().mockResolvedValue(undefined) } },
        { provide: LoggerService, useValue: { error: vi.fn() } },
        { provide: StoryPresentationService, useValue: story },
        {
          provide: RealtimeDataService,
          useValue: {
            get: vi.fn().mockResolvedValue(null),
            set: vi.fn().mockResolvedValue(undefined),
            update: vi.fn().mockResolvedValue(undefined),
            remove: vi.fn().mockResolvedValue(undefined),
            subscribe: vi.fn().mockReturnValue(of(null)),
          },
        },
        {
          provide: SceneLibraryService,
          useValue: {
            creatures: signal([]),
            scenes: signal([]),
            saveCreature: vi.fn(),
            deleteCreature: vi.fn(),
            saveScene: vi.fn(),
            deleteScene: vi.fn(),
            resolveScene: vi.fn(),
          },
        },
        {
          provide: ItemLibraryService,
          useValue: { items: signal([]), saveItem: vi.fn(), deleteItem: vi.fn() },
        },
      ],
    });

    fixture = TestBed.createComponent(DmControlComponent);
    component = fixture.componentInstance;
  });

  it('renders the workspace shell and keeps battle synchronization mounted', () => {
    fixture.detectChanges();

    expect(component.activePanel()).toBe('scenes');
    expect(fixture.nativeElement.querySelector('app-dm-scene-library')).toBeInTheDocument();
    expect(fixture.nativeElement.querySelector('app-dm-battle-controls')).toBeInTheDocument();
    expect(fixture.nativeElement.querySelector('.dm-workspace-grid')).toHaveAttribute('hidden');
    expect(fixture.nativeElement.querySelectorAll('.dm-workspace-tabs button')).toHaveLength(6);
  });

  it('shows the language switcher in the settings panel', () => {
    component.activePanel.set('settings');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.dm-settings-panel bf-language-switcher')).toBeInTheDocument();
  });

  it('shows the composed battle workspace without duplicating its form logic in the shell', () => {
    component.activePanel.set('battle');
    fixture.detectChanges();

    const workspace = fixture.nativeElement.querySelector('.dm-workspace-grid');
    expect(workspace).not.toHaveAttribute('hidden');
    expect(workspace.querySelector('app-dm-combatant-roster')).toBeInTheDocument();
    expect(workspace.querySelector('app-dm-hp-control')).toBeInTheDocument();
    expect(workspace.querySelector('app-dm-status-effects')).toBeInTheDocument();
    expect(workspace.querySelector('app-dm-battle-history')).toBeInTheDocument();
    expect(workspace.querySelector('app-dm-initiative')).toBeInTheDocument();
  });

  it('coordinates initiative state and returns to scenes after scene completion', () => {
    component.activePanel.set('battle');
    component.openInitiative({ goblin: 12 });

    expect(component.initiativeVisible()).toBe(true);
    expect(component.initiativeRolls()).toEqual({ goblin: 12 });

    component.returnToScenes();

    expect(component.initiativeVisible()).toBe(false);
    expect(component.activePanel()).toBe('scenes');
  });

  it('composes existing and one-off reward tools in the rewards workspace', () => {
    component.activePanel.set('rewards');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('app-dm-character-resources')).toBeInTheDocument();
    expect(fixture.nativeElement.querySelector('app-dm-item-library')).toBeInTheDocument();
    expect(fixture.nativeElement.querySelector('app-dm-item-grant')).toBeInTheDocument();
    expect(fixture.nativeElement.querySelector('app-dm-spell-grant')).toBeInTheDocument();
  });
});
