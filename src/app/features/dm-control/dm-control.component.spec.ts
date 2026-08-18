import { signal, WritableSignal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BATTLE_STATUS, BattleStatus } from '../../core/constants/battle-status.constants';
import { COMBATANT_STATUS, COMBATANT_TYPE } from '../../core/constants/combatant.constants';
import { ITEM_RARITY } from '../../core/constants/item-rarity.constants';
import { ParsedCharacter } from '../../core/models/character.model';
import { Combatant } from '../../core/models/combatant.model';
import { BattleService } from '../../core/services/battle.service';
import { CharacterService } from '../../core/services/character.service';
import { InventoryService } from '../../core/services/inventory.service';
import { ItemLibraryService } from '../../core/services/item-library.service';
import { LoggerService } from '../../core/services/logger.service';
import { SceneLibraryService } from '../../core/services/scene-library.service';
import { DmControlComponent } from './dm-control.component';

describe('DmControlComponent', () => {
  let fixture: ComponentFixture<DmControlComponent>;
  let component: DmControlComponent;
  let battle: {
    battleStatus: WritableSignal<BattleStatus>;
    aliveEnemies: WritableSignal<Combatant[]>;
    sortedCombatants: WritableSignal<Combatant[]>;
    currentRound: WritableSignal<number>;
    currentCombatant: WritableSignal<Combatant | null>;
    history: WritableSignal<[]>;
    canUndo: WritableSignal<boolean>;
    playersInBattle: WritableSignal<Record<string, Combatant>>;
    combatants: WritableSignal<Record<string, Combatant>>;
    enemies: WritableSignal<Record<string, Combatant>>;
    syncPlayersToBattle: ReturnType<typeof vi.fn>;
    removePlayerFromBattle: ReturnType<typeof vi.fn>;
    addEnemy: ReturnType<typeof vi.fn>;
    updateEnemy: ReturnType<typeof vi.fn>;
    removeEnemy: ReturnType<typeof vi.fn>;
    endBattle: ReturnType<typeof vi.fn>;
    setInitiative: ReturnType<typeof vi.fn>;
    sortInitiative: ReturnType<typeof vi.fn>;
    rollInitiative: ReturnType<typeof vi.fn>;
    startBattle: ReturnType<typeof vi.fn>;
    damageAll: ReturnType<typeof vi.fn>;
    takeDamage: ReturnType<typeof vi.fn>;
    damageMany: ReturnType<typeof vi.fn>;
    heal: ReturnType<typeof vi.fn>;
    healMany: ReturnType<typeof vi.fn>;
    setTemporaryHp: ReturnType<typeof vi.fn>;
    addStatusEffect: ReturnType<typeof vi.fn>;
    removeStatusEffect: ReturnType<typeof vi.fn>;
    recordDeathSave: ReturnType<typeof vi.fn>;
    revive: ReturnType<typeof vi.fn>;
    nextTurn: ReturnType<typeof vi.fn>;
    undoLastAction: ReturnType<typeof vi.fn>;
    resetScene: ReturnType<typeof vi.fn>;
    finishScene: ReturnType<typeof vi.fn>;
    addCreatureStacks: ReturnType<typeof vi.fn>;
    setCurrentTurn: ReturnType<typeof vi.fn>;
    moveCombatant: ReturnType<typeof vi.fn>;
  };
  let characterService: {
    getAllPlayers: ReturnType<typeof vi.fn>;
    updatePlayerSpells: ReturnType<typeof vi.fn>;
    restorePlayerSpells: ReturnType<typeof vi.fn>;
    loadCharacter: ReturnType<typeof vi.fn>;
    setSpellSlotPool: ReturnType<typeof vi.fn>;
    upsertResource: ReturnType<typeof vi.fn>;
  };
  let inventoryService: { giveItem: ReturnType<typeof vi.fn> };
  let logger: { error: ReturnType<typeof vi.fn> };

  const enemy = (id = 'goblin-1'): Combatant => ({
    id,
    type: COMBATANT_TYPE.ENEMY,
    subtype: 'goblin',
    name: 'Goblin',
    initiative: 14,
    ac: 13,
    maxHp: 12,
    currentHp: 12,
    status: COMBATANT_STATUS.ALIVE,
  });

  const playerCombatant = (
    name: string,
    status: Combatant['status'] = COMBATANT_STATUS.ALIVE,
  ): Combatant => ({
    id: 'player_' + name,
    type: COMBATANT_TYPE.PLAYER,
    name,
    playerName: name,
    initiative: 10,
    ac: 14,
    maxHp: 24,
    currentHp: 20,
    status,
  });

  const player = (name: string): ParsedCharacter => ({
    name,
    class: 'Fighter',
    level: 3,
    race: 'Human',
    stats: { str: 16, dex: 12, con: 14, int: 10, wis: 10, cha: 10 },
    maxHp: 24,
    currentHp: 24,
    ac: 16,
    speed: 30,
    weapons: [],
    abilities: [],
  });

  beforeEach(() => {
    battle = {
      battleStatus: signal<BattleStatus>(BATTLE_STATUS.PREPARATION),
      aliveEnemies: signal<Combatant[]>([]),
      sortedCombatants: signal<Combatant[]>([]),
      currentRound: signal(1),
      currentCombatant: signal<Combatant | null>(null),
      history: signal([]),
      canUndo: signal(false),
      playersInBattle: signal<Record<string, Combatant>>({}),
      combatants: signal<Record<string, Combatant>>({}),
      enemies: signal<Record<string, Combatant>>({}),
      syncPlayersToBattle: vi.fn().mockResolvedValue(undefined),
      removePlayerFromBattle: vi.fn().mockResolvedValue(undefined),
      addEnemy: vi.fn().mockResolvedValue('enemy-new'),
      updateEnemy: vi.fn().mockResolvedValue(undefined),
      removeEnemy: vi.fn().mockResolvedValue(undefined),
      endBattle: vi.fn().mockResolvedValue(undefined),
      setInitiative: vi.fn().mockResolvedValue(undefined),
      sortInitiative: vi.fn().mockResolvedValue(undefined),
      rollInitiative: vi.fn().mockResolvedValue(undefined),
      startBattle: vi.fn().mockResolvedValue(undefined),
      damageAll: vi.fn().mockResolvedValue(undefined),
      takeDamage: vi.fn().mockResolvedValue(undefined),
      damageMany: vi.fn().mockResolvedValue(undefined),
      heal: vi.fn().mockResolvedValue(undefined),
      healMany: vi.fn().mockResolvedValue(undefined),
      setTemporaryHp: vi.fn().mockResolvedValue(undefined),
      addStatusEffect: vi.fn().mockResolvedValue(true),
      removeStatusEffect: vi.fn().mockResolvedValue(true),
      recordDeathSave: vi.fn().mockResolvedValue(true),
      revive: vi.fn().mockResolvedValue(true),
      nextTurn: vi.fn().mockResolvedValue(undefined),
      undoLastAction: vi.fn().mockResolvedValue(undefined),
      resetScene: vi.fn().mockResolvedValue(undefined),
      finishScene: vi.fn().mockResolvedValue(undefined),
      addCreatureStacks: vi.fn().mockResolvedValue([]),
      setCurrentTurn: vi.fn().mockResolvedValue(true),
      moveCombatant: vi.fn().mockResolvedValue(true),
    };
    characterService = {
      getAllPlayers: vi.fn().mockResolvedValue([]),
      updatePlayerSpells: vi.fn().mockResolvedValue(undefined),
      restorePlayerSpells: vi.fn().mockResolvedValue(undefined),
      loadCharacter: vi.fn().mockResolvedValue(null),
      setSpellSlotPool: vi.fn().mockResolvedValue(undefined),
      upsertResource: vi.fn().mockResolvedValue(undefined),
    };
    inventoryService = {
      giveItem: vi.fn().mockResolvedValue(undefined),
    };
    logger = { error: vi.fn() };

    TestBed.configureTestingModule({
      imports: [DmControlComponent],
      providers: [
        { provide: BattleService, useValue: battle },
        { provide: CharacterService, useValue: characterService },
        { provide: InventoryService, useValue: inventoryService },
        {
          provide: ItemLibraryService,
          useValue: {
            items: signal([]),
            saveItem: vi.fn(),
            deleteItem: vi.fn(),
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
        { provide: LoggerService, useValue: logger },
      ],
    });

    fixture = TestBed.createComponent(DmControlComponent);
    component = fixture.componentInstance;
  });

  it('automatically synchronizes all saved players in one battle-service operation', async () => {
    const aria = player('Aria');
    const borin = player('Borin');
    characterService.getAllPlayers.mockResolvedValue([aria, borin]);

    component.ngOnInit();

    await vi.waitFor(() =>
      expect(battle.syncPlayersToBattle).toHaveBeenCalledWith([aria, borin]),
    );
    expect(battle.syncPlayersToBattle).toHaveBeenCalledTimes(1);
    expect(component.playersLoading()).toBe(false);
  });

  it('logs player loading failures without breaking component initialization', async () => {
    const error = new Error('players unavailable');
    characterService.getAllPlayers.mockRejectedValue(error);

    component.ngOnInit();

    await vi.waitFor(() =>
      expect(logger.error).toHaveBeenCalledWith(
        'DmControlComponent.loadPlayersToBattle',
        error,
      ),
    );
  });

  it('gives a normalized item to the selected player and resets the form', async () => {
    component.selectedPlayerIdForItem.set('player_Aria');
    component.itemName.set('  Healing Potion  ');
    component.itemDescription.set('  Restores HP  ');
    component.itemQuantity.set(2);
    component.itemRarity.set(ITEM_RARITY.RARE);

    component.giveItem();

    await vi.waitFor(() =>
      expect(inventoryService.giveItem).toHaveBeenCalledWith('Aria', {
        name: 'Healing Potion',
        quantity: 2,
        description: 'Restores HP',
        rarity: ITEM_RARITY.RARE,
      }),
    );
    await vi.waitFor(() => expect(component.selectedPlayerIdForItem()).toBeNull());
    expect(component.itemName()).toBe('');
    expect(component.itemDescription()).toBe('');
    expect(component.itemQuantity()).toBe(1);
    expect(component.itemRarity()).toBe(ITEM_RARITY.COMMON);
  });

  it('builds a complete spell and derives cantrip state from level', async () => {
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('00000000-0000-4000-8000-000000000002');
    component.selectedPlayerIdForSpell.set('player_Aria');
    component.spellName.set('  Fire Bolt  ');
    component.spellLevel.set(0);
    component.spellSchool.set('  Evocation  ');
    component.spellDescription.set('  Ranged spell attack  ');
    component.spellDamageFormula.set('  1d10  ');
    component.spellDamageType.set('  fire  ');

    component.giveSpell();

    await vi.waitFor(() =>
      expect(characterService.updatePlayerSpells).toHaveBeenCalledWith('Aria', {
        id: 'spell-00000000-0000-4000-8000-000000000002',
        name: 'Fire Bolt',
        level: 0,
        school: 'Evocation',
        description: 'Ranged spell attack',
        damageFormula: '1d10',
        damageType: 'fire',
        isCantrip: true,
        isPrepared: true,
      }),
    );
    await vi.waitFor(() => expect(component.selectedPlayerIdForSpell()).toBeNull());
    expect(component.spellName()).toBe('');
    expect(component.isSpellCantrip()).toBe(true);
  });

  it('gives a leveled spell without creating a separate per-spell counter', async () => {
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('00000000-0000-4000-8000-000000000003');
    component.selectedPlayerIdForSpell.set('player_Aria');
    component.spellName.set('Shield');
    component.spellLevel.set(1);
    component.giveSpell();

    await vi.waitFor(() =>
      expect(characterService.updatePlayerSpells).toHaveBeenCalledWith(
        'Aria',
        expect.objectContaining({
          name: 'Shield',
          level: 1,
          isCantrip: false,
        }),
      ),
    );
    const granted = characterService.updatePlayerSpells.mock.calls[0][1];
    expect(granted).not.toHaveProperty('maxUses');
    expect(granted).not.toHaveProperty('usesRemaining');
  });

  it('restores spell uses for the selected player', async () => {
    component.selectedPlayerIdForSpell.set('player_Aria');

    component.restoreSpells();

    await vi.waitFor(() =>
      expect(characterService.restorePlayerSpells).toHaveBeenCalledWith('Aria'),
    );
  });

  it('filters damage targets to alive combatants of the selected type', () => {
    const alivePlayer = playerCombatant('Aria');
    const deadPlayer = playerCombatant('Borin', COMBATANT_STATUS.DEAD);
    battle.aliveEnemies.set([enemy()]);
    battle.playersInBattle.set({
      [alivePlayer.id]: alivePlayer,
      [deadPlayer.id]: deadPlayer,
    });

    component.targetType.set('enemies');
    expect(component.availableTargets()).toEqual([enemy()]);

    component.targetType.set('players');
    expect(component.availableTargets()).toEqual([alivePlayer]);

    component.targetType.set('all');
    expect(component.availableTargets()).toEqual([enemy()]);
  });

  it('renders combatant lists safely before the first turn is assigned', () => {
    const goblin = enemy();
    const aria = playerCombatant('Aria');
    battle.aliveEnemies.set([goblin]);
    battle.enemies.set({ [goblin.id]: goblin });
    battle.playersInBattle.set({ [aria.id]: aria });
    battle.sortedCombatants.set([goblin, aria]);
    battle.currentCombatant.set(null);
    component.activePanel.set('battle');

    fixture.detectChanges();

    expect(fixture.nativeElement).toHaveTextContent('Goblin');
    expect(fixture.nativeElement).toHaveTextContent('Aria');
    expect(fixture.nativeElement.querySelector('.combatant-item--active')).toBeNull();
  });

  it('orders the main workspaces as scenes, battle, rewards, then Open5e', () => {
    fixture.detectChanges();

    const labels = Array.from(
      fixture.nativeElement.querySelectorAll<HTMLButtonElement>('.dm-workspace-tabs button'),
    ).map((button) => button.textContent?.replace(/\s+/g, ' ').trim());

    expect(labels).toEqual([
      '1 🗺️ Сцены и существа',
      '2 ⚔️ Бой 0',
      '3 🎁 Игроки и награды',
      '4 📚 Переводы Open5E',
    ]);
  });

  it('switches between focused desktop workspaces instead of rendering a long dashboard', () => {
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-dm-scene-library')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.dm-workspace-grid')).toBeNull();

    component.activePanel.set('battle');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.dm-workspace-grid')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('app-dm-scene-library')).toBeNull();

    component.activePanel.set('rewards');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-dm-item-library')).not.toBeNull();
  });

  it('applies group and single-target damage and resets the panel on success', async () => {
    battle.aliveEnemies.set([enemy()]);
    component.targetType.set('all');
    component.damageAmount.set(5);
    expect(component.canApplyDamage()).toBe(true);

    component.applyDamage();

    await vi.waitFor(() => expect(battle.damageAll).toHaveBeenCalledWith(5));
    await vi.waitFor(() => expect(component.damageAmount()).toBe(0));
    expect(component.damageTargetId()).toBeNull();

    component.targetType.set('players');
    component.damageTargetId.set('player_Aria');
    component.damageAmount.set(3);
    component.applyDamage();

    await vi.waitFor(() =>
      expect(battle.takeDamage).toHaveBeenCalledWith('player_Aria', 3),
    );
    await vi.waitFor(() => expect(component.damageAmount()).toBe(0));
    expect(component.damageTargetId()).toBeNull();
  });

  it('keeps the damage panel intact and logs a failed write', async () => {
    const error = new Error('write denied');
    battle.takeDamage.mockRejectedValue(error);
    component.targetType.set('enemies');
    component.damageTargetId.set('goblin-1');
    component.damageAmount.set(4);

    component.applyDamage();

    await vi.waitFor(() =>
      expect(logger.error).toHaveBeenCalledWith('DmControlComponent.applyDamage', error),
    );
    expect(component.damageAmount()).toBe(4);
    expect(component.damageTargetId()).toBe('goblin-1');
  });

  it('heals the selected combatant and resets the HP panel after success', async () => {
    component.setHpOperation('heal');
    component.targetType.set('players');
    component.damageTargetId.set('player_Aria');
    component.damageAmount.set(6);

    expect(component.canApplyHealing()).toBe(true);
    component.applyHealing();

    await vi.waitFor(() => expect(battle.heal).toHaveBeenCalledWith('player_Aria', 6));
    await vi.waitFor(() => expect(component.damageAmount()).toBe(0));
    expect(component.damageTargetId()).toBeNull();
    expect(component.hpOperation()).toBe('heal');
  });

  it('caps healing at missing HP while leaving damage input unrestricted', () => {
    const aria = playerCombatant('Aria');
    battle.combatants.set({ [aria.id]: aria });
    component.setHpOperation('heal');
    component.damageTargetId.set(aria.id);

    component.onDamageAmountInput({ target: { value: '99' } } as unknown as Event);
    expect(component.maxHealingAmount()).toBe(4);
    expect(component.damageAmount()).toBe(4);

    component.setHpOperation('damage');
    component.damageTargetId.set(aria.id);
    component.onDamageAmountInput({ target: { value: '99' } } as unknown as Event);
    expect(component.damageAmount()).toBe(99);
  });

  it('removes mass targeting when switching from damage to healing', () => {
    component.targetType.set('all');
    component.damageAmount.set(5);

    component.setHpOperation('heal');

    expect(component.targetType()).toBe('enemies');
    expect(component.damageAmount()).toBe(0);
    expect(component.canApplyHealing()).toBe(false);
  });

  it('assigns and removes status effects for any combatant', async () => {
    const goblin = enemy();
    goblin.activeEffects = [{ id: 'effect-fire', type: 'burning', appliedAt: 1 }];
    battle.combatants.set({ [goblin.id]: goblin });
    battle.sortedCombatants.set([goblin]);
    component.selectedStatusTargetId.set(goblin.id);
    component.selectStatusEffect('poisoned');
    component.statusDamage.set(3);
    component.statusDuration.set(2);

    component.applyStatusEffect();

    await vi.waitFor(() =>
      expect(battle.addStatusEffect).toHaveBeenCalledWith(goblin.id, 'poisoned', {
        damagePerTrigger: 3,
        durationTriggers: 2,
        trigger: 'turn-start',
        source: '',
        concentrationSourceId: undefined,
        saveAbility: '',
        saveDc: 0,
        notes: '',
      }),
    );
    component.removeStatusEffect(goblin.id, 'effect-fire');
    await vi.waitFor(() =>
      expect(battle.removeStatusEffect).toHaveBeenCalledWith(goblin.id, 'effect-fire'),
    );
  });

  it('rolls initiative locally and advances UI only after confirmation succeeds', async () => {
    const first = enemy('goblin-1');
    const second = enemy('goblin-2');
    battle.enemies.set({ [first.id]: first, [second.id]: second });
    vi.spyOn(Math, 'random').mockReturnValue(0.5);

    component.startInitiativeRolls();

    expect(component.initiativeRolls()).toEqual({
      'goblin-1': 11,
      'goblin-2': 11,
    });
    expect(component.showInitiativeRolls()).toBe(true);

    component.confirmInitiative();

    await vi.waitFor(() => expect(battle.rollInitiative).toHaveBeenCalledOnce());
    await vi.waitFor(() => expect(component.showInitiativeRolls()).toBe(false));
  });

  it('records death saves and revives incapacitated combatants', async () => {
    component.recordDeathSave('player_Aria', 'success');
    component.reviveCombatant('player_Aria');

    await vi.waitFor(() =>
      expect(battle.recordDeathSave).toHaveBeenCalledWith('player_Aria', 'success'),
    );
    await vi.waitFor(() => expect(battle.revive).toHaveBeenCalledWith('player_Aria', 1));
  });

  it('finishes a scene only after confirmation and returns to the scene workspace', async () => {
    vi.stubGlobal('confirm', vi.fn().mockReturnValue(true));
    component.activePanel.set('battle');

    component.finishScene('preserve');

    await vi.waitFor(() => expect(battle.finishScene).toHaveBeenCalledWith('preserve'));
    await vi.waitFor(() => expect(component.activePanel()).toBe('scenes'));
    expect(component.transitioningScene()).toBe(false);
  });

  it('resets the battle only after user confirmation', async () => {
    const confirm = vi.fn().mockReturnValueOnce(false).mockReturnValueOnce(true);
    vi.stubGlobal('confirm', confirm);
    component.showInitiativeRolls.set(true);

    component.resetScene();
    expect(battle.resetScene).not.toHaveBeenCalled();

    component.resetScene();
    await vi.waitFor(() => expect(battle.resetScene).toHaveBeenCalledOnce());
    expect(component.showInitiativeRolls()).toBe(false);
  });
});
