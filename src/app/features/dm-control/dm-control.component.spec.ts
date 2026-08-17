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
import {
  EnemyGeneratorService,
  GeneratedEnemyFlavor,
} from '../../core/services/enemy-generator.service';
import { InventoryService } from '../../core/services/inventory.service';
import { LoggerService } from '../../core/services/logger.service';
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
    playersInBattle: WritableSignal<Record<string, Combatant>>;
    combatants: WritableSignal<Record<string, Combatant>>;
    enemies: WritableSignal<Record<string, Combatant>>;
    addPlayerToBattle: ReturnType<typeof vi.fn>;
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
    nextTurn: ReturnType<typeof vi.fn>;
    undoLastAction: ReturnType<typeof vi.fn>;
    resetScene: ReturnType<typeof vi.fn>;
  };
  let characterService: {
    getAllPlayers: ReturnType<typeof vi.fn>;
    updatePlayerSpells: ReturnType<typeof vi.fn>;
    restorePlayerSpells: ReturnType<typeof vi.fn>;
  };
  let inventoryService: { giveItem: ReturnType<typeof vi.fn> };
  let enemyGenerator: { generateFlavor: ReturnType<typeof vi.fn> };
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

  const flavor: GeneratedEnemyFlavor = {
    actions: [
      {
        name: 'Dagger',
        description: 'Melee Attack',
        toHit: '+4',
        damage: '1d4 + 2',
        damageType: 'piercing',
      },
    ],
    statuses: ['poisoned'],
    resistances: ['fire'],
  };

  beforeEach(() => {
    battle = {
      battleStatus: signal<BattleStatus>(BATTLE_STATUS.PREPARATION),
      aliveEnemies: signal<Combatant[]>([]),
      sortedCombatants: signal<Combatant[]>([]),
      currentRound: signal(1),
      currentCombatant: signal<Combatant | null>(null),
      playersInBattle: signal<Record<string, Combatant>>({}),
      combatants: signal<Record<string, Combatant>>({}),
      enemies: signal<Record<string, Combatant>>({}),
      addPlayerToBattle: vi.fn().mockResolvedValue(undefined),
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
      nextTurn: vi.fn().mockResolvedValue(undefined),
      undoLastAction: vi.fn().mockResolvedValue(undefined),
      resetScene: vi.fn().mockResolvedValue(undefined),
    };
    characterService = {
      getAllPlayers: vi.fn().mockResolvedValue([]),
      updatePlayerSpells: vi.fn().mockResolvedValue(undefined),
      restorePlayerSpells: vi.fn().mockResolvedValue(undefined),
    };
    inventoryService = {
      giveItem: vi.fn().mockResolvedValue(undefined),
    };
    enemyGenerator = {
      generateFlavor: vi.fn().mockReturnValue(flavor),
    };
    logger = { error: vi.fn() };

    TestBed.configureTestingModule({
      imports: [DmControlComponent],
      providers: [
        { provide: BattleService, useValue: battle },
        { provide: CharacterService, useValue: characterService },
        { provide: InventoryService, useValue: inventoryService },
        { provide: EnemyGeneratorService, useValue: enemyGenerator },
        { provide: LoggerService, useValue: logger },
      ],
    });

    fixture = TestBed.createComponent(DmControlComponent);
    component = fixture.componentInstance;
  });

  it('loads saved players sequentially to avoid initiative-order write races', async () => {
    const aria = player('Aria');
    const borin = player('Borin');
    let resolveFirst: (() => void) | undefined;
    characterService.getAllPlayers.mockResolvedValue([aria, borin]);
    battle.addPlayerToBattle
      .mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            resolveFirst = resolve;
          }),
      )
      .mockResolvedValueOnce(undefined);

    component.ngOnInit();

    await vi.waitFor(() =>
      expect(battle.addPlayerToBattle).toHaveBeenCalledWith(aria, 0),
    );
    expect(battle.addPlayerToBattle).toHaveBeenCalledTimes(1);

    resolveFirst?.();
    await vi.waitFor(() =>
      expect(battle.addPlayerToBattle).toHaveBeenNthCalledWith(2, borin, 0),
    );
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

  it('creates a flavored enemy and resets the form after persistence', async () => {
    component.newEnemyName.set('  Goblin Boss  ');
    component.newEnemyType.set('goblin');
    component.newEnemyMaxHp.set(40);
    component.newEnemyAc.set(16);

    component.addEnemy();

    await vi.waitFor(() =>
      expect(battle.addEnemy).toHaveBeenCalledWith({
        type: COMBATANT_TYPE.ENEMY,
        subtype: 'goblin',
        name: 'Goblin Boss',
        ac: 16,
        maxHp: 40,
        actions: flavor.actions,
        statuses: flavor.statuses,
        resistances: flavor.resistances,
      }),
    );
    await vi.waitFor(() => expect(component.newEnemyName()).toBe(''));
    expect(component.newEnemyMaxHp()).toBe(10);
    expect(component.newEnemyAc()).toBe(12);
  });

  it('does not generate or persist an invalid enemy', () => {
    component.newEnemyName.set(' ');
    component.addEnemy();

    component.newEnemyName.set('Goblin');
    component.newEnemyMaxHp.set(0);
    component.addEnemy();

    expect(enemyGenerator.generateFlavor).not.toHaveBeenCalled();
    expect(battle.addEnemy).not.toHaveBeenCalled();
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

  it('gives a leveled spell its configured uses and resets the usage field', async () => {
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('00000000-0000-4000-8000-000000000003');
    component.selectedPlayerIdForSpell.set('player_Aria');
    component.spellName.set('Shield');
    component.spellLevel.set(1);
    component.spellMaxUses.set(3);

    component.giveSpell();

    await vi.waitFor(() =>
      expect(characterService.updatePlayerSpells).toHaveBeenCalledWith(
        'Aria',
        expect.objectContaining({
          name: 'Shield',
          level: 1,
          isCantrip: false,
          maxUses: 3,
          usesRemaining: 3,
        }),
      ),
    );
    await vi.waitFor(() => expect(component.spellMaxUses()).toBe(1));
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
    expect(component.availableTargets()).toEqual([]);
  });

  it('renders combatant lists safely before the first turn is assigned', () => {
    const goblin = enemy();
    const aria = playerCombatant('Aria');
    battle.aliveEnemies.set([goblin]);
    battle.enemies.set({ [goblin.id]: goblin });
    battle.playersInBattle.set({ [aria.id]: aria });
    battle.currentCombatant.set(null);

    fixture.detectChanges();

    expect(fixture.nativeElement).toHaveTextContent('Goblin');
    expect(fixture.nativeElement).toHaveTextContent('Aria');
    expect(fixture.nativeElement.querySelector('.enemy-item--active')).toBeNull();
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
    expect(component.showAddForm()).toBe(false);
  });

  it('resets the battle only after user confirmation', async () => {
    const confirm = vi.fn().mockReturnValueOnce(false).mockReturnValueOnce(true);
    vi.stubGlobal('confirm', confirm);
    component.showAddForm.set(false);
    component.showInitiativeRolls.set(true);

    component.resetScene();
    expect(battle.resetScene).not.toHaveBeenCalled();

    component.resetScene();
    await vi.waitFor(() => expect(battle.resetScene).toHaveBeenCalledOnce());
    await vi.waitFor(() => expect(component.showAddForm()).toBe(true));
    expect(component.showInitiativeRolls()).toBe(false);
  });

  it('regenerates flavor for every enemy in the scene', async () => {
    const first = enemy('goblin-1');
    const second = enemy('goblin-2');
    battle.enemies.set({ [first.id]: first, [second.id]: second });

    component.randomizeAllEnemies();

    await vi.waitFor(() => expect(battle.updateEnemy).toHaveBeenCalledTimes(2));
    expect(battle.updateEnemy).toHaveBeenNthCalledWith(1, first.id, {
      actions: flavor.actions,
      statuses: flavor.statuses,
      resistances: flavor.resistances,
    });
    expect(battle.updateEnemy).toHaveBeenNthCalledWith(2, second.id, {
      actions: flavor.actions,
      statuses: flavor.statuses,
      resistances: flavor.resistances,
    });
  });
});
