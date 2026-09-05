import { WritableSignal, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Combatant } from '../../core/models/combatant.model';
import { COMBATANT_STATUS, COMBATANT_TYPE } from '../../core/constants/combatant.constants';
import { STATUS_EFFECT_TYPE } from '../../core/constants/status-effect.constants';
import { DmBattleWorkspaceComponent } from './battle-workspace/dm-battle-workspace.component';
import { DmHpControlComponent } from './hp-control/dm-hp-control.component';
import { DmStatusEffectsComponent } from './status-effects/dm-status-effects.component';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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

  afterEach(() => vi.unstubAllGlobals());

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
    expect(fixture.nativeElement.querySelector('.dm-battle-workspace-host')).toHaveAttribute('hidden');
    expect(fixture.nativeElement.querySelectorAll('.dm-workspace-tabs button')).toHaveLength(6);
  });

  it('shows the language switcher in the settings panel', () => {
    component.activePanel.set('settings');
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelector('.dm-settings-panel bf-language-switcher'),
    ).toBeInTheDocument();
  });

  it('shows the composed battle workspace without duplicating its form logic in the shell', () => {
    component.activePanel.set('battle');
    fixture.detectChanges();

    const workspace = fixture.nativeElement.querySelector('.dm-battle-workspace-host');
    expect(workspace).not.toHaveAttribute('hidden');
    expect(workspace.querySelector('app-dm-combatant-roster')).toBeInTheDocument();
    expect(workspace.querySelector('app-dm-hp-control')).toBeInTheDocument();
    expect(workspace.querySelector('app-dm-status-effects')).toBeInTheDocument();
    expect(workspace.querySelector('app-dm-battle-history')).toBeInTheDocument();
    expect(workspace.querySelector('app-dm-initiative')).toBeInTheDocument();
  });

  function mountBattle() {
    component.activePanel.set('battle');
    fixture.detectChanges();
    const workspace: DmBattleWorkspaceComponent = fixture.debugElement.query(By.directive(DmBattleWorkspaceComponent)).componentInstance;
    const dialog: HTMLDialogElement = fixture.nativeElement.querySelector('dialog');
    // jsdom has no native dialog API or layout; emulate only the open state.
    dialog.show = vi.fn(() => dialog.setAttribute('open', ''));
    dialog.showModal = vi.fn(() => dialog.setAttribute('open', ''));
    dialog.close = vi.fn(() => dialog.removeAttribute('open'));
    return { workspace, dialog };
  }

  it('coordinates initiative in the drawer and returns to scenes after scene completion', () => {
    const { workspace, dialog } = mountBattle();
    workspace.openInitiative({ goblin: 12 });
    fixture.detectChanges();

    expect(workspace.initiativeVisible()).toBe(true);
    expect(workspace.initiativeRolls()).toEqual({ goblin: 12 });
    expect(dialog).toHaveAttribute('open');
    expect(dialog.querySelector('.dm-section--initiative')).toBeVisible();

    workspace.finishScene();
    fixture.detectChanges();
    expect(workspace.initiativeVisible()).toBe(false);
    expect(dialog).not.toHaveAttribute('open');
    expect(component.activePanel()).toBe('scenes');
  });

  it('opens one tool at a time, preserves effect drafts, and restores focus on Escape', () => {
    const { dialog } = mountBattle();
    const cards: NodeListOf<HTMLButtonElement> = fixture.nativeElement.querySelectorAll('.dm-battle-tool');
    expect(cards).toHaveLength(4);
    expect(dialog).not.toHaveAttribute('open');

    cards[2].click();
    fixture.detectChanges();
    expect(dialog.show).toHaveBeenCalledOnce();
    expect(dialog.showModal).not.toHaveBeenCalled();
    expect(cards[2]).toHaveAttribute('aria-expanded', 'true');
    expect(dialog.querySelector('app-dm-status-effects')).toBeVisible();
    expect(dialog.querySelector('app-dm-combatant-roster')).not.toBeVisible();
    expect(fixture.nativeElement.querySelector('.dm-battle-bar')).toBeVisible();
    expect(fixture.nativeElement.querySelector('app-dm-hp-control')).toBeVisible();
    const effects: DmStatusEffectsComponent = fixture.debugElement.query(By.directive(DmStatusEffectsComponent)).componentInstance;
    effects.notes.set('Keep this draft');

    cards[3].click();
    fixture.detectChanges();
    expect(dialog.querySelector('app-dm-status-effects')).not.toBeVisible();
    expect(dialog.querySelector('app-dm-battle-history')).toBeVisible();
    cards[2].click();
    fixture.detectChanges();
    expect(effects.notes()).toBe('Keep this draft');

    dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();
    expect(dialog).not.toHaveAttribute('open');
    expect(cards[2]).toHaveFocus();
    expect(cards[2]).toHaveAttribute('aria-expanded', 'false');
  });

  it('uses a modal dialog on a narrow screen and handles native cancellation', () => {
    vi.stubGlobal('innerWidth', 390);
    const { workspace, dialog } = mountBattle();
    workspace.openTool('participants');
    fixture.detectChanges();
    expect(dialog.showModal).toHaveBeenCalledOnce();
    expect(dialog.show).not.toHaveBeenCalled();
    dialog.dispatchEvent(new Event('cancel', { cancelable: true }));
    fixture.detectChanges();
    expect(dialog).not.toHaveAttribute('open');
    expect(workspace.activeTool()).toBeNull();
  });

  it('adapts an open drawer when the viewport changes and closes it when leaving battle', () => {
    const { workspace, dialog } = mountBattle();
    workspace.openTool('history');
    vi.stubGlobal('innerWidth', 390);
    workspace.updateDialogMode();
    expect(dialog.showModal).toHaveBeenCalledOnce();
    expect(workspace.activeTool()).toBe('history');
    component.activePanel.set('settings');
    fixture.detectChanges();
    expect(dialog).not.toHaveAttribute('open');
    expect(workspace.activeTool()).toBeNull();
  });

  it('selects an HP target from the live roster and updates effect counts from battle state', () => {
    const { workspace } = mountBattle();
    const battle = TestBed.inject(BattleService);
    const aria: Combatant = {
      id: 'player_Aria', name: 'Aria', type: COMBATANT_TYPE.PLAYER,
      status: COMBATANT_STATUS.ALIVE, currentHp: 20, maxHp: 24, ac: 14, initiative: 12,
      activeEffects: [{ id: 'poison', type: STATUS_EFFECT_TYPE.POISONED, appliedAt: 1 }],
    };
    (battle.sortedCombatants as WritableSignal<Combatant[]>).set([aria]);
    (battle.combatants as WritableSignal<Record<string, Combatant>>).set({ [aria.id]: aria });
    (battle.playersInBattle as WritableSignal<Record<string, Combatant>>).set({ [aria.id]: aria });
    fixture.detectChanges();
    const target: HTMLButtonElement = fixture.nativeElement.querySelector('.dm-battle-combatant__target');
    target.click();
    fixture.detectChanges();
    const hp: DmHpControlComponent = fixture.debugElement.query(By.directive(DmHpControlComponent)).componentInstance;
    expect(hp.targetId()).toBe(aria.id);
    expect(hp.targetType()).toBe('players');
    expect(target).toHaveAttribute('aria-pressed', 'true');
    expect(workspace.effectCount()).toBe(1);
    expect(workspace.playerCount()).toBe(1);
    expect(fixture.nativeElement.querySelector('bf-status-effect-list')).toHaveTextContent('Отравление');
    (battle.sortedCombatants as WritableSignal<Combatant[]>).set([{ ...aria, activeEffects: [] }]);
    fixture.detectChanges();
    expect(workspace.effectCount()).toBe(0);
  });

  it('shows preparation actions before battle and guards repeated next-turn clicks', async () => {
    mountBattle();
    const battle = TestBed.inject(BattleService);
    let buttons: HTMLButtonElement[] = Array.from(fixture.nativeElement.querySelectorAll('.dm-battle-quick-actions button'));
    expect(buttons).toHaveLength(3);
    buttons[1].click();
    expect(battle.startBattle).toHaveBeenCalledOnce();
    (battle.battleStatus as WritableSignal<string>).set(BATTLE_STATUS.BATTLE);
    fixture.detectChanges();
    buttons = Array.from(fixture.nativeElement.querySelectorAll('.dm-battle-quick-actions button'));
    expect(buttons).toHaveLength(2);
    let finishTurn!: () => void;
    vi.mocked(battle.nextTurn).mockImplementation(() => new Promise<void>((resolve) => {
      finishTurn = resolve;
    }));
    buttons[0].click();
    buttons[0].click();
    expect(battle.nextTurn).toHaveBeenCalledOnce();
    fixture.detectChanges();
    expect(buttons[0]).toBeDisabled();
    finishTurn();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(buttons[0]).toBeEnabled();
  });

  it('keeps player synchronization mounted while switching tools and tabs', async () => {
    const { workspace } = mountBattle();
    await fixture.whenStable();
    workspace.openTool('controls');
    fixture.detectChanges();
    workspace.openTool('participants');
    fixture.detectChanges();
    component.activePanel.set('settings');
    fixture.detectChanges();
    component.activePanel.set('battle');
    fixture.detectChanges();
    expect(TestBed.inject(BattleService).syncPlayersToBattle).toHaveBeenCalledOnce();
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
