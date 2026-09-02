import { TestBed } from '@angular/core/testing';
import { Observable, ReplaySubject } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import {
  BATTLE_STATUS,
  COMBATANT_STATUS,
  COMBATANT_TYPE,
  DEATH_SAVE_RESULT,
  STATUS_EFFECT_TRIGGER,
  STATUS_EFFECT_TYPE,
} from '../../constants';
import { BattleRoom, Combatant, CreatureTemplate } from '../../models';
import { BattleService } from '../battle.service';
import { CharacterService } from '../character.service';
import { DamageCalculationService } from '../damage-calculation.service';
import { RealtimeDataService } from '../realtime-data.service';
import { InitiativeService } from '../initiative.service';

const ROOM_PATH = 'rooms/main-room';
const UUID = '00000000-0000-4000-8000-000000000001';
const NOW = 1_700_000_000_000;

class RealtimeDataServiceFake
  implements Pick<RealtimeDataService, 'get' | 'set' | 'update' | 'remove' | 'subscribe'>
{
  readonly getMock = vi.fn<(path: string) => Promise<unknown | null>>();
  readonly setMock = vi.fn<(path: string, data: unknown) => Promise<void>>();
  readonly updateMock = vi.fn<(path: string, data: Record<string, unknown>) => Promise<void>>();
  readonly removeMock = vi.fn<(path: string) => Promise<void>>();
  readonly subscribeMock = vi.fn<(path: string) => Observable<unknown | null>>();

  constructor(room$: Observable<BattleRoom | null>, existingRoom: BattleRoom | null) {
    this.getMock.mockResolvedValue(existingRoom);
    this.setMock.mockResolvedValue(undefined);
    this.updateMock.mockResolvedValue(undefined);
    this.removeMock.mockResolvedValue(undefined);
    this.subscribeMock.mockReturnValue(room$);
  }

  get<T>(path: string): Promise<T | null> {
    return this.getMock(path) as Promise<T | null>;
  }

  set<T>(path: string, data: T): Promise<void> {
    return this.setMock(path, data);
  }

  update(path: string, data: Record<string, unknown>): Promise<void> {
    return this.updateMock(path, data);
  }

  remove(path: string): Promise<void> {
    return this.removeMock(path);
  }

  subscribe<T>(path: string): Observable<T | null> {
    return this.subscribeMock(path) as Observable<T | null>;
  }

  clearCalls(): void {
    this.getMock.mockClear();
    this.setMock.mockClear();
    this.updateMock.mockClear();
    this.removeMock.mockClear();
    this.subscribeMock.mockClear();
  }
}

describe('BattleService', () => {
  let service: BattleService;
  let realtimeData: RealtimeDataServiceFake;
  let room$: ReplaySubject<BattleRoom | null>;
  let characterService: {
    updatePlayerHp: ReturnType<typeof vi.fn>;
    updatePlayerHealth: ReturnType<typeof vi.fn>;
    completeShortRest: ReturnType<typeof vi.fn>;
    completeLongRest: ReturnType<typeof vi.fn>;
  };
  let initiativeService: {
    sortByInitiative: ReturnType<typeof vi.fn>;
    setInitiative: ReturnType<typeof vi.fn>;
  };

  async function setup(initialRoom: BattleRoom | null = createRoom()): Promise<void> {
    room$ = new ReplaySubject<BattleRoom | null>(1);
    room$.next(initialRoom);
    realtimeData = new RealtimeDataServiceFake(room$.asObservable(), initialRoom);
    characterService = {
      updatePlayerHp: vi.fn().mockResolvedValue(undefined),
      updatePlayerHealth: vi.fn().mockResolvedValue(undefined),
      completeShortRest: vi.fn().mockResolvedValue(undefined),
      completeLongRest: vi.fn().mockResolvedValue(undefined),
    };
    initiativeService = {
      sortByInitiative: vi.fn().mockResolvedValue(undefined),
      setInitiative: vi.fn().mockResolvedValue(undefined),
    };

    TestBed.configureTestingModule({
      providers: [
        BattleService,
        DamageCalculationService,
        { provide: RealtimeDataService, useValue: realtimeData },
        { provide: CharacterService, useValue: characterService },
        { provide: InitiativeService, useValue: initiativeService },
      ],
    });
    service = TestBed.inject(BattleService);
    await vi.waitFor(() => expect(realtimeData.getMock).toHaveBeenCalledWith(ROOM_PATH));
  }

  it('creates an empty room when database has no room yet', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(NOW);
    await setup(null);

    await vi.waitFor(() => expect(realtimeData.setMock).toHaveBeenCalledOnce());
    expect(realtimeData.setMock).toHaveBeenCalledWith(ROOM_PATH, {
      status: 'preparation',
      currentRound: 1,
      currentTurnIndex: 0,
      combatants: {},
      initiativeOrder: [],
      history: [],
      lastUpdated: NOW,
    });
  });

  it('recomputes battle projections when database emits a new room', async () => {
    await setup();
    expect(service.aliveEnemies().map((enemy) => enemy.id)).toEqual(['enemy-1']);
    expect(service.currentCombatant()?.id).toBe('enemy-1');

    room$.next(
      createRoom({
        combatants: {
          'enemy-1': createCombatant({ id: 'enemy-1', status: COMBATANT_STATUS.DEAD }),
          'player-1': createCombatant({
            id: 'player-1',
            type: COMBATANT_TYPE.PLAYER,
            name: 'Aria',
          }),
        },
        initiativeOrder: ['player-1', 'enemy-1'],
      }),
    );

    expect(service.aliveEnemies()).toEqual([]);
    expect(service.currentCombatant()?.id).toBe('player-1');
  });

  it('adds a complete enemy and appends its id to initiative order', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(NOW);
    vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue(UUID);
    await setup();
    realtimeData.clearCalls();

    const id = await service.addEnemy(createEnemyInput({ name: 'Orc', maxHp: 15 }));

    expect(id).toBe(`enemy_${UUID}`);
    expect(realtimeData.setMock).toHaveBeenCalledOnce();
    expect(realtimeData.setMock).toHaveBeenCalledWith(`${ROOM_PATH}/combatants/enemy_${UUID}`, {
      id: `enemy_${UUID}`,
      type: 'enemy',
      subtype: 'goblin',
      name: 'Orc',
      initiative: 0,
      ac: 15,
      maxHp: 15,
      currentHp: 15,
      status: 'alive',
      actions: [],
      statuses: [],
      resistances: [],
      lastUpdated: NOW,
    });
    expect(realtimeData.updateMock).toHaveBeenCalledOnce();
    expect(realtimeData.updateMock).toHaveBeenCalledWith(ROOM_PATH, {
      initiativeOrder: ['enemy-1', `enemy_${UUID}`],
      lastUpdated: NOW,
    });
  });

  it('adds all creatures from scene stacks in one room update', async () => {
    const firstUuid = '00000000-0000-4000-8000-000000000011';
    const secondUuid = '00000000-0000-4000-8000-000000000012';
    vi.spyOn(Date, 'now').mockReturnValue(NOW);
    vi.spyOn(globalThis.crypto, 'randomUUID')
      .mockReturnValueOnce(firstUuid)
      .mockReturnValueOnce(secondUuid);
    await setup(createRoom({ initiativeOrder: ['enemy-1'] }));
    realtimeData.clearCalls();
    const template: CreatureTemplate = {
      id: 'creature-goblin',
      name: 'Goblin',
      subtype: 'goblin',
      maxHp: 10,
      ac: 12,
      actions: [{ name: 'Sword', description: 'Melee', toHit: '+4', damage: '1d6+2', damageType: 'piercing' }],
      abilities: [{ name: 'Nimble Escape', description: 'Disengage as a bonus action.' }],
      resistances: ['fire'],
      statuses: [],
      createdAt: NOW,
      lastUpdated: NOW,
    };

    await expect(service.addCreatureStacks([{ template, quantity: 2 }])).resolves.toEqual([
      `enemy_${firstUuid}`,
      `enemy_${secondUuid}`,
    ]);

    expect(realtimeData.updateMock).toHaveBeenCalledOnce();
    expect(realtimeData.updateMock).toHaveBeenCalledWith(
      ROOM_PATH,
      expect.objectContaining({
        [`combatants/enemy_${firstUuid}`]: expect.objectContaining({
          name: 'Goblin 1',
          currentHp: 10,
          actions: template.actions,
          abilities: template.abilities,
        }),
        [`combatants/enemy_${secondUuid}`]: expect.objectContaining({ name: 'Goblin 2' }),
        initiativeOrder: ['enemy-1', `enemy_${firstUuid}`, `enemy_${secondUuid}`],
        lastUpdated: NOW,
      }),
    );
  });

  it('never sends undefined optional creature collections to database', async () => {
    vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue(UUID);
    await setup();
    realtimeData.clearCalls();
    const legacyTemplate = {
      id: 'legacy',
      name: 'Legacy Goblin',
      subtype: 'goblin',
      maxHp: 7,
      ac: 12,
      createdAt: NOW,
      lastUpdated: NOW,
    } as CreatureTemplate;

    await service.addCreatureStacks([{ template: legacyTemplate, quantity: 1 }]);

    expect(realtimeData.updateMock).toHaveBeenCalledWith(
      ROOM_PATH,
      expect.objectContaining({
        [`combatants/enemy_${UUID}`]: expect.objectContaining({
          actions: [],
          abilities: [],
          resistances: [],
          statuses: [],
        }),
      }),
    );
  });

  it('damages an enemy, records undo state and restores previous HP', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(NOW);
    vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue(UUID);
    await setup();
    realtimeData.clearCalls();

    await service.takeDamage('enemy-1', 4);

    expect(realtimeData.updateMock).toHaveBeenCalledWith(ROOM_PATH, expect.objectContaining({
      'combatants/enemy-1/currentHp': 6,
      'combatants/enemy-1/status': COMBATANT_STATUS.ALIVE,
      'combatants/enemy-1/deathSaves': null,
      history: expect.any(Array),
      lastUpdated: NOW,
    }));
    expect(service.canUndo()).toBe(true);
    expect(characterService.updatePlayerHp).not.toHaveBeenCalled();

    await service.undoLastAction();
    expect(realtimeData.updateMock).toHaveBeenLastCalledWith(ROOM_PATH, expect.objectContaining({
      'combatants/enemy-1': expect.objectContaining({ currentHp: 10 }),
      history: null,
      lastUpdated: NOW,
    }));
    expect(service.canUndo()).toBe(false);
  });

  it('clamps player damage at zero and synchronizes character HP', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(NOW);
    vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue(UUID);
    await setup(
      createRoom({
        combatants: {
          'player-aria': createCombatant({
            id: 'player-aria',
            type: COMBATANT_TYPE.PLAYER,
            name: 'Aria',
            playerName: 'Aria',
            currentHp: 3,
          }),
        },
        initiativeOrder: ['player-aria'],
      }),
    );
    realtimeData.clearCalls();

    await service.takeDamage('player-aria', 10);

    expect(realtimeData.updateMock).toHaveBeenCalledWith(ROOM_PATH, expect.objectContaining({
      'combatants/player-aria/currentHp': 0,
      'combatants/player-aria/status': COMBATANT_STATUS.DOWNED,
      'combatants/player-aria/deathSaves': { successes: 0, failures: 0 },
      history: expect.any(Array),
      lastUpdated: NOW,
    }));
    expect(characterService.updatePlayerHealth).toHaveBeenCalledOnce();
    expect(characterService.updatePlayerHealth).toHaveBeenCalledWith('Aria', 0, 0);
  });

  it('marks an enemy dead on lethal damage', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(NOW);
    await setup();
    realtimeData.clearCalls();

    await service.takeDamage('enemy-1', 20);

    expect(realtimeData.updateMock).toHaveBeenCalledWith(ROOM_PATH, expect.objectContaining({
      'combatants/enemy-1/currentHp': 0,
      'combatants/enemy-1/status': COMBATANT_STATUS.DEAD,
      'combatants/enemy-1/deathSaves': null,
      history: expect.any(Array),
    }));
  });

  it('stabilizes a downed player after the third successful death save', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(NOW);
    await setup(
      createRoom({
        combatants: {
          player_Aria: createCombatant({
            id: 'player_Aria',
            type: COMBATANT_TYPE.PLAYER,
            name: 'Aria',
            playerName: 'Aria',
            currentHp: 0,
            status: COMBATANT_STATUS.DOWNED,
            deathSaves: { successes: 2, failures: 1 },
          }),
        },
        initiativeOrder: ['player_Aria'],
      }),
    );
    realtimeData.clearCalls();

    await expect(
      service.recordDeathSave('player_Aria', DEATH_SAVE_RESULT.SUCCESS),
    ).resolves.toBe(true);

    expect(realtimeData.updateMock).toHaveBeenCalledWith(ROOM_PATH, expect.objectContaining({
      'combatants/player_Aria/currentHp': 0,
      'combatants/player_Aria/status': COMBATANT_STATUS.STABLE,
      'combatants/player_Aria/deathSaves': { successes: 3, failures: 1 },
      history: expect.any(Array),
    }));
  });

  it('kills a downed player after the third failed death save', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(NOW);
    await setup(
      createRoom({
        combatants: {
          player_Aria: createCombatant({
            id: 'player_Aria',
            type: COMBATANT_TYPE.PLAYER,
            name: 'Aria',
            currentHp: 0,
            status: COMBATANT_STATUS.DOWNED,
            deathSaves: { successes: 1, failures: 2 },
          }),
        },
        initiativeOrder: ['player_Aria'],
      }),
    );
    realtimeData.clearCalls();

    await service.recordDeathSave('player_Aria', DEATH_SAVE_RESULT.FAILURE);

    expect(realtimeData.updateMock).toHaveBeenCalledWith(ROOM_PATH, expect.objectContaining({
      'combatants/player_Aria/currentHp': 0,
      'combatants/player_Aria/status': COMBATANT_STATUS.DEAD,
      'combatants/player_Aria/deathSaves': { successes: 1, failures: 3 },
      history: expect.any(Array),
    }));
  });

  it('returns a player to battle on a critical success and through DM revival', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(NOW);
    const downed = createCombatant({
      id: 'player_Aria',
      type: COMBATANT_TYPE.PLAYER,
      name: 'Aria',
      playerName: 'Aria',
      currentHp: 0,
      status: COMBATANT_STATUS.DOWNED,
      deathSaves: { successes: 0, failures: 2 },
    });
    await setup(
      createRoom({ combatants: { player_Aria: downed }, initiativeOrder: ['player_Aria'] }),
    );
    realtimeData.clearCalls();

    await service.recordDeathSave('player_Aria', DEATH_SAVE_RESULT.CRITICAL_SUCCESS);

    expect(realtimeData.updateMock).toHaveBeenCalledWith(ROOM_PATH, expect.objectContaining({
      'combatants/player_Aria/currentHp': 1,
      'combatants/player_Aria/status': COMBATANT_STATUS.ALIVE,
      'combatants/player_Aria/deathSaves': null,
      history: expect.any(Array),
    }));
    expect(characterService.updatePlayerHealth).toHaveBeenCalledWith('Aria', 1, 0);

    room$.next(
      createRoom({
        combatants: {
          player_Aria: { ...downed, status: COMBATANT_STATUS.DEAD },
        },
        initiativeOrder: ['player_Aria'],
      }),
    );
    realtimeData.clearCalls();

    await expect(service.revive('player_Aria')).resolves.toBe(true);
    expect(realtimeData.updateMock).toHaveBeenCalledWith(ROOM_PATH, expect.objectContaining({
      'combatants/player_Aria/currentHp': 1,
      'combatants/player_Aria/status': COMBATANT_STATUS.ALIVE,
      'combatants/player_Aria/deathSaves': null,
      history: expect.any(Array),
    }));
  });

  it('does nothing when damage target does not exist', async () => {
    await setup();
    realtimeData.clearCalls();

    await service.takeDamage('missing', 5);

    expect(realtimeData.updateMock).not.toHaveBeenCalled();
    expect(characterService.updatePlayerHp).not.toHaveBeenCalled();
    expect(service.canUndo()).toBe(false);
  });

  it('damages only alive enemies with one multi-location update', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(NOW);
    await setup(
      createRoom({
        combatants: {
          'enemy-1': createCombatant({ id: 'enemy-1', currentHp: 10 }),
          'enemy-2': createCombatant({
            id: 'enemy-2',
            currentHp: 4,
            status: COMBATANT_STATUS.DEAD,
          }),
          'player-1': createCombatant({ id: 'player-1', type: COMBATANT_TYPE.PLAYER }),
        },
        initiativeOrder: ['enemy-1', 'enemy-2', 'player-1'],
      }),
    );
    realtimeData.clearCalls();

    await service.damageAll(3);

    expect(realtimeData.updateMock).toHaveBeenCalledOnce();
    expect(realtimeData.updateMock).toHaveBeenCalledWith(ROOM_PATH, {
      'combatants/enemy-1/currentHp': 7,
      'combatants/enemy-1/temporaryHp': 0,
      'combatants/enemy-1/status': COMBATANT_STATUS.ALIVE,
      'combatants/enemy-1/lastUpdated': NOW,
      history: expect.any(Array),
      lastUpdated: NOW,
    });
    expect(service.canUndo()).toBe(true);
  });

  it('starts a new round after the last combatant turn', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(NOW);
    await setup(
      createRoom({ status: BATTLE_STATUS.BATTLE, currentRound: 3, currentTurnIndex: 0 }),
    );
    realtimeData.clearCalls();

    await service.nextTurn();

    expect(realtimeData.updateMock).toHaveBeenCalledWith(ROOM_PATH, expect.objectContaining({
      currentTurnIndex: 0,
      currentRound: 4,
      lastUpdated: NOW,
      history: expect.any(Array),
    }));
  });

  it('advances to the next combatant without incrementing the round', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(NOW);
    await setup(
      createRoom({
        status: BATTLE_STATUS.BATTLE,
        currentRound: 3,
        currentTurnIndex: 0,
        combatants: {
          'enemy-1': createCombatant({ id: 'enemy-1' }),
          'enemy-2': createCombatant({ id: 'enemy-2' }),
        },
        initiativeOrder: ['enemy-1', 'enemy-2'],
      }),
    );
    realtimeData.clearCalls();

    await service.nextTurn();

    expect(realtimeData.updateMock).toHaveBeenCalledWith(ROOM_PATH, expect.objectContaining({
      currentTurnIndex: 1,
      currentRound: 3,
      lastUpdated: NOW,
      history: expect.any(Array),
    }));
  });

  it('coalesces repeated next-turn clicks while a transition is still saving', async () => {
    await setup(createRoom({ status: BATTLE_STATUS.BATTLE }));
    realtimeData.clearCalls();
    let finishWrite: (() => void) | undefined;
    realtimeData.updateMock.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finishWrite = resolve;
        }),
    );

    const first = service.nextTurn();
    const second = service.nextTurn();

    expect(first).toBe(second);
    expect(realtimeData.updateMock).toHaveBeenCalledOnce();
    finishWrite?.();
    await first;
  });

  it('updates an existing enemy and ignores an unknown enemy', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(NOW);
    await setup();
    realtimeData.clearCalls();

    await service.updateEnemy('enemy-1', { ac: 18 });
    expect(realtimeData.updateMock).toHaveBeenCalledWith(`${ROOM_PATH}/combatants/enemy-1`, {
      ac: 18,
      lastUpdated: NOW,
    });

    realtimeData.updateMock.mockClear();
    await service.updateEnemy('missing', { ac: 99 });
    expect(realtimeData.updateMock).not.toHaveBeenCalled();
  });

  it('removes an enemy from both combatants and initiative order', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(NOW);
    await setup();
    realtimeData.clearCalls();

    await service.removeEnemy('enemy-1');

    expect(realtimeData.removeMock).toHaveBeenCalledWith(`${ROOM_PATH}/combatants/enemy-1`);
    expect(realtimeData.updateMock).toHaveBeenCalledWith(ROOM_PATH, {
      initiativeOrder: [],
      lastUpdated: NOW,
    });
  });

  it('adds a player once and appends them to initiative order', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(NOW);
    await setup();
    realtimeData.clearCalls();
    const player = { ...createPlayer(), currentHp: 9 };

    await service.addPlayerToBattle(player, 17);

    expect(realtimeData.setMock).toHaveBeenCalledWith(`${ROOM_PATH}/combatants/player_Aria`, {
      id: 'player_Aria',
      type: 'player',
      name: 'Aria',
      initiative: 17,
      ac: 16,
      maxHp: 24,
      currentHp: 9,
      status: 'alive',
      temporaryHp: 0,
      playerName: 'Aria',
      emoji: '🧙',
      lastUpdated: NOW,
    });
    expect(realtimeData.updateMock).toHaveBeenCalledWith(ROOM_PATH, {
      initiativeOrder: ['enemy-1', 'player_Aria'],
      lastUpdated: NOW,
    });
  });

  it('synchronizes all stored players in one room update without overwriting combat HP', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(NOW);
    const existingAria = createCombatant({
      id: 'player_Aria',
      type: COMBATANT_TYPE.PLAYER,
      name: 'Aria',
      playerName: 'Aria',
      currentHp: 5,
    });
    const room = createRoom({
      combatants: { 'enemy-1': createCombatant(), player_Aria: existingAria },
      initiativeOrder: ['enemy-1'],
    });
    await setup(room);
    realtimeData.clearCalls();
    const borin = { ...createPlayer(), name: 'Borin', currentHp: 11 };

    await service.syncPlayersToBattle([createPlayer(), borin]);

    expect(realtimeData.setMock).not.toHaveBeenCalled();
    expect(realtimeData.updateMock).toHaveBeenCalledOnce();
    expect(realtimeData.updateMock).toHaveBeenCalledWith(ROOM_PATH, {
      'combatants/player_Borin': expect.objectContaining({
        id: 'player_Borin',
        name: 'Borin',
        currentHp: 11,
        initiative: 0,
      }),
      initiativeOrder: ['enemy-1', 'player_Aria', 'player_Borin'],
      lastUpdated: NOW,
    });
    expect(realtimeData.updateMock.mock.calls[0][1]).not.toHaveProperty('combatants/player_Aria');
  });

  it('does not add a player already present in the room', async () => {
    await setup(
      createRoom({
        combatants: {
          player_Aria: createCombatant({
            id: 'player_Aria',
            type: COMBATANT_TYPE.PLAYER,
            name: 'Aria',
          }),
        },
        initiativeOrder: ['player_Aria'],
      }),
    );
    realtimeData.clearCalls();

    await service.addPlayerToBattle(createPlayer(), 17);

    expect(realtimeData.setMock).not.toHaveBeenCalled();
    expect(realtimeData.updateMock).not.toHaveBeenCalled();
  });

  it('restores an existing player missing from initiative order', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(NOW);
    await setup(
      createRoom({
        combatants: {
          player_Aria: createCombatant({
            id: 'player_Aria',
            type: COMBATANT_TYPE.PLAYER,
            name: 'Aria',
          }),
        },
        initiativeOrder: [],
      }),
    );
    realtimeData.clearCalls();

    await service.addPlayerToBattle(createPlayer(), 17);

    expect(realtimeData.setMock).not.toHaveBeenCalled();
    expect(realtimeData.updateMock).toHaveBeenCalledWith(ROOM_PATH, {
      initiativeOrder: ['player_Aria'],
      lastUpdated: NOW,
    });
  });

  it('caps healing at max HP and makes it reversible', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(NOW);
    vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue(UUID);
    await setup(
      createRoom({
        combatants: { 'enemy-1': createCombatant({ id: 'enemy-1', currentHp: 7 }) },
      }),
    );
    realtimeData.clearCalls();

    await service.heal('enemy-1', 10);

    expect(realtimeData.updateMock).toHaveBeenCalledWith(ROOM_PATH, expect.objectContaining({
      'combatants/enemy-1/currentHp': 10,
      'combatants/enemy-1/status': COMBATANT_STATUS.ALIVE,
      'combatants/enemy-1/deathSaves': null,
      history: expect.any(Array),
    }));
    expect(service.canUndo()).toBe(true);
  });

  it('persists healed player HP to the character sheet', async () => {
    await setup(
      createRoom({
        combatants: {
          player_Aria: createCombatant({
            id: 'player_Aria',
            type: COMBATANT_TYPE.PLAYER,
            name: 'Aria',
            playerName: 'Aria',
            currentHp: 4,
            maxHp: 10,
          }),
        },
        initiativeOrder: ['player_Aria'],
      }),
    );
    realtimeData.clearCalls();

    await service.heal('player_Aria', 3);

    expect(characterService.updatePlayerHealth).toHaveBeenCalledWith('Aria', 7, 0);
  });

  it('returns a downed player to life when they receive healing', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(NOW);
    await setup(
      createRoom({
        combatants: {
          player_Aria: createCombatant({
            id: 'player_Aria',
            type: COMBATANT_TYPE.PLAYER,
            name: 'Aria',
            playerName: 'Aria',
            currentHp: 0,
            status: COMBATANT_STATUS.DOWNED,
            deathSaves: { successes: 1, failures: 2 },
          }),
        },
        initiativeOrder: ['player_Aria'],
      }),
    );
    realtimeData.clearCalls();

    await service.heal('player_Aria', 4);

    expect(realtimeData.updateMock).toHaveBeenCalledWith(ROOM_PATH, expect.objectContaining({
      'combatants/player_Aria/currentHp': 4,
      'combatants/player_Aria/status': COMBATANT_STATUS.ALIVE,
      'combatants/player_Aria/deathSaves': null,
      history: expect.any(Array),
    }));
    expect(characterService.updatePlayerHealth).toHaveBeenCalledWith('Aria', 4, 0);
  });

  it('adds a unique status effect to a combatant', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(NOW);
    vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue(UUID);
    await setup();
    realtimeData.clearCalls();

    await expect(
      service.addStatusEffect('enemy-1', STATUS_EFFECT_TYPE.BURNING),
    ).resolves.toBe(true);

    expect(realtimeData.updateMock).toHaveBeenCalledWith(ROOM_PATH, expect.objectContaining({
      'combatants/enemy-1/activeEffects': [
        {
          id: `effect_${UUID}`,
          type: STATUS_EFFECT_TYPE.BURNING,
          appliedAt: NOW,
        },
      ],
      history: expect.any(Array),
      lastUpdated: NOW,
    }));
  });

  it('stores configured turn damage, timing, and duration on an effect', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(NOW);
    vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue(UUID);
    await setup();
    realtimeData.clearCalls();

    await service.addStatusEffect('enemy-1', STATUS_EFFECT_TYPE.BURNING, {
      damagePerTrigger: 3,
      trigger: STATUS_EFFECT_TRIGGER.TURN_END,
      durationTriggers: 2,
    });

    expect(realtimeData.updateMock).toHaveBeenCalledWith(ROOM_PATH, expect.objectContaining({
      'combatants/enemy-1/activeEffects': [
        {
          id: `effect_${UUID}`,
          type: STATUS_EFFECT_TYPE.BURNING,
          appliedAt: NOW,
          damagePerTrigger: 3,
          trigger: STATUS_EFFECT_TRIGGER.TURN_END,
          remainingTriggers: 2,
        },
      ],
      history: expect.any(Array),
      lastUpdated: NOW,
    }));
  });

  it('stores a named resource effect independently from other resources', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(NOW);
    vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue(UUID);
    await setup();
    realtimeData.clearCalls();

    await expect(service.addStatusEffect('enemy-1', STATUS_EFFECT_TYPE.RESOURCE_ACTIVE, {
      resourceId: 'rage',
      customLabel: 'Ярость',
      customIcon: '🔥',
      trigger: STATUS_EFFECT_TRIGGER.TURN_END,
      durationTriggers: 2,
      durationLabel: 'до конца следующего хода',
    })).resolves.toBe(true);

    expect(realtimeData.updateMock).toHaveBeenCalledWith(ROOM_PATH, expect.objectContaining({
      'combatants/enemy-1/activeEffects': [expect.objectContaining({
        type: STATUS_EFFECT_TYPE.RESOURCE_ACTIVE,
        resourceId: 'rage',
        customLabel: 'Ярость',
        customIcon: '🔥',
        remainingTriggers: 2,
      })],
    }));
  });

  it('refreshes the duration of an active resource effect', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(NOW);
    const effect = {
      id: 'effect-rage',
      type: STATUS_EFFECT_TYPE.RESOURCE_ACTIVE,
      appliedAt: 1,
      resourceId: 'rage',
      customLabel: 'Ярость',
      remainingTriggers: 1,
    };
    await setup(createRoom({
      combatants: { 'enemy-1': createCombatant({ activeEffects: [effect] }) },
      initiativeOrder: ['enemy-1'],
    }));
    realtimeData.clearCalls();

    await expect(
      service.refreshStatusEffect('enemy-1', effect.id, 2, 'до конца следующего хода'),
    ).resolves.toBe(true);

    expect(realtimeData.updateMock).toHaveBeenCalledWith(ROOM_PATH, expect.objectContaining({
      'combatants/enemy-1/activeEffects': [expect.objectContaining({
        id: effect.id,
        remainingTriggers: 2,
        durationLabel: 'до конца следующего хода',
      })],
      history: expect.any(Array),
    }));
  });

  it('processes end/start effects once, expires them, and downs the next player', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(NOW);
    const first = createCombatant({
      id: 'enemy-1',
      currentHp: 5,
      activeEffects: [
        {
          id: 'burning',
          type: STATUS_EFFECT_TYPE.BURNING,
          appliedAt: 1,
          damagePerTrigger: 2,
          trigger: STATUS_EFFECT_TRIGGER.TURN_END,
          remainingTriggers: 1,
        },
      ],
    });
    const player = createCombatant({
      id: 'player_Aria',
      type: COMBATANT_TYPE.PLAYER,
      name: 'Aria',
      playerName: 'Aria',
      currentHp: 4,
      activeEffects: [
        {
          id: 'poisoned',
          type: STATUS_EFFECT_TYPE.POISONED,
          appliedAt: 1,
          damagePerTrigger: 5,
          trigger: STATUS_EFFECT_TRIGGER.TURN_START,
          remainingTriggers: 2,
        },
      ],
    });
    await setup(
      createRoom({
        status: BATTLE_STATUS.BATTLE,
        combatants: { 'enemy-1': first, player_Aria: player },
        initiativeOrder: ['enemy-1', 'player_Aria'],
      }),
    );
    realtimeData.clearCalls();

    await service.nextTurn();

    expect(realtimeData.updateMock).toHaveBeenCalledWith(ROOM_PATH, expect.any(Object));
    const updates = realtimeData.updateMock.mock.calls[0][1];
    const processedEnemy = updates['combatants/enemy-1'] as Combatant;
    const processedPlayer = updates['combatants/player_Aria'] as Combatant;
    expect(processedEnemy.currentHp).toBe(3);
    expect(processedEnemy.activeEffects).toBeUndefined();
    expect(processedPlayer).toEqual(
      expect.objectContaining({
        currentHp: 0,
        status: COMBATANT_STATUS.DOWNED,
        deathSaves: { successes: 0, failures: 0 },
        activeEffects: [expect.objectContaining({ remainingTriggers: 1 })],
      }),
    );
    expect(updates).toEqual(
      expect.objectContaining({
        currentTurnIndex: 1,
        currentRound: 1,
        lastUpdated: NOW,
      }),
    );
    expect(characterService.updatePlayerHp).toHaveBeenCalledWith('Aria', 0);
  });

  it('skips dead and stable combatants when selecting the next turn', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(NOW);
    await setup(
      createRoom({
        status: BATTLE_STATUS.BATTLE,
        combatants: {
          'enemy-1': createCombatant({ id: 'enemy-1' }),
          dead: createCombatant({ id: 'dead', status: COMBATANT_STATUS.DEAD }),
          stable: createCombatant({
            id: 'stable',
            type: COMBATANT_TYPE.PLAYER,
            status: COMBATANT_STATUS.STABLE,
            currentHp: 0,
          }),
          next: createCombatant({ id: 'next' }),
        },
        initiativeOrder: ['enemy-1', 'dead', 'stable', 'next'],
      }),
    );
    realtimeData.clearCalls();

    await service.nextTurn();

    expect(realtimeData.updateMock).toHaveBeenCalledWith(ROOM_PATH, expect.objectContaining({
      currentTurnIndex: 3,
      currentRound: 1,
      lastUpdated: NOW,
      history: expect.any(Array),
    }));
  });

  it('does not duplicate an existing status effect', async () => {
    await setup(
      createRoom({
        combatants: {
          'enemy-1': createCombatant({
            id: 'enemy-1',
            activeEffects: [
              { id: 'effect-fire', type: STATUS_EFFECT_TYPE.BURNING, appliedAt: NOW },
            ],
          }),
        },
      }),
    );
    realtimeData.clearCalls();

    await expect(
      service.addStatusEffect('enemy-1', STATUS_EFFECT_TYPE.BURNING),
    ).resolves.toBe(false);
    expect(realtimeData.updateMock).not.toHaveBeenCalled();
  });

  it('removes the final status effect without writing an empty database array', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(NOW);
    await setup(
      createRoom({
        combatants: {
          'enemy-1': createCombatant({
            id: 'enemy-1',
            activeEffects: [
              { id: 'effect-poison', type: STATUS_EFFECT_TYPE.POISONED, appliedAt: NOW },
            ],
          }),
        },
      }),
    );
    realtimeData.clearCalls();

    await expect(service.removeStatusEffect('enemy-1', 'effect-poison')).resolves.toBe(true);
    expect(realtimeData.updateMock).toHaveBeenCalledWith(ROOM_PATH, expect.objectContaining({
      'combatants/enemy-1/activeEffects': null,
      history: expect.any(Array),
      lastUpdated: NOW,
    }));
  });

  it('delegates initiative operations and moves the room into initiative state', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(NOW);
    await setup();
    realtimeData.clearCalls();

    await service.setInitiative('enemy-1', 19);
    await service.sortInitiative();
    await service.rollInitiative();

    expect(initiativeService.setInitiative).toHaveBeenCalledWith(ROOM_PATH, 'enemy-1', 19);
    expect(initiativeService.sortByInitiative).toHaveBeenCalledTimes(2);
    expect(initiativeService.sortByInitiative).toHaveBeenCalledWith(
      ROOM_PATH,
      service.combatants(),
    );
    expect(realtimeData.updateMock).toHaveBeenCalledWith(ROOM_PATH, {
      status: 'initiative',
      currentRound: 1,
      currentTurnIndex: 0,
      lastUpdated: NOW,
    });
  });

  it('finishes a scene while retaining players, HP, and life state', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(NOW);
    const player = createCombatant({
      id: 'player_Aria',
      type: COMBATANT_TYPE.PLAYER,
      name: 'Aria',
      playerName: 'Aria',
      initiative: 18,
      currentHp: 0,
      status: COMBATANT_STATUS.DOWNED,
      deathSaves: { successes: 1, failures: 1 },
      activeEffects: [
        { id: 'poison', type: STATUS_EFFECT_TYPE.POISONED, appliedAt: 1 },
      ],
    });
    await setup(
      createRoom({
        status: BATTLE_STATUS.BATTLE,
        combatants: { 'enemy-1': createCombatant(), player_Aria: player },
        initiativeOrder: ['enemy-1', 'player_Aria'],
      }),
    );
    realtimeData.clearCalls();

    await service.finishScene('preserve');

    expect(realtimeData.setMock).toHaveBeenCalledWith(ROOM_PATH, {
      status: BATTLE_STATUS.PREPARATION,
      currentRound: 1,
      currentTurnIndex: 0,
      combatants: {
        player_Aria: expect.objectContaining({
          initiative: 0,
          currentHp: 0,
          status: COMBATANT_STATUS.DOWNED,
          deathSaves: { successes: 1, failures: 1 },
        }),
      },
      initiativeOrder: ['player_Aria'],
      lastUpdated: NOW,
    });
    const writtenRoom = realtimeData.setMock.mock.calls[0][1] as BattleRoom;
    expect(writtenRoom.combatants['player_Aria'].activeEffects).toBeUndefined();
  });

  it('fully rests living players while leaving dead players dead between scenes', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(NOW);
    const aria = createCombatant({
      id: 'player_Aria',
      type: COMBATANT_TYPE.PLAYER,
      name: 'Aria',
      playerName: 'Aria',
      currentHp: 2,
      maxHp: 12,
    });
    const borin = createCombatant({
      id: 'player_Borin',
      type: COMBATANT_TYPE.PLAYER,
      name: 'Borin',
      playerName: 'Borin',
      currentHp: 0,
      status: COMBATANT_STATUS.DEAD,
    });
    await setup(
      createRoom({
        combatants: { player_Aria: aria, player_Borin: borin },
        initiativeOrder: ['player_Aria', 'player_Borin'],
      }),
    );
    realtimeData.clearCalls();

    await service.finishScene('long-rest');

    const writtenRoom = realtimeData.setMock.mock.calls[0][1] as BattleRoom;
    expect(writtenRoom.combatants['player_Aria']).toEqual(
      expect.objectContaining({ currentHp: 12, status: COMBATANT_STATUS.ALIVE }),
    );
    expect(writtenRoom.combatants['player_Borin']).toEqual(
      expect.objectContaining({ currentHp: 0, status: COMBATANT_STATUS.DEAD }),
    );
    expect(characterService.completeLongRest).toHaveBeenCalledWith('Aria', 12);
    expect(characterService.completeLongRest).not.toHaveBeenCalledWith('Borin', expect.anything());
  });

  it('writes battle lifecycle states and resets local undo history', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(NOW);
    vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue(UUID);
    await setup();
    realtimeData.clearCalls();
    await service.takeDamage('enemy-1', 1);
    expect(service.canUndo()).toBe(true);

    await service.startBattle();
    await service.endBattle();
    await service.resetScene();

    expect(realtimeData.updateMock).toHaveBeenCalledWith(ROOM_PATH, {
      status: 'battle',
      lastUpdated: NOW,
    });
    expect(realtimeData.updateMock).toHaveBeenCalledWith(ROOM_PATH, {
      status: 'ended',
      lastUpdated: NOW,
    });
    expect(realtimeData.setMock).toHaveBeenCalledWith(
      ROOM_PATH,
      expect.objectContaining({
        status: 'preparation',
        combatants: {},
        initiativeOrder: [],
        lastUpdated: NOW,
      }),
    );
    expect(service.canUndo()).toBe(false);
  });

  it('absorbs damage with temporary HP before regular HP and syncs both values', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(NOW);
    const aria = createCombatant({
      id: 'player_Aria',
      type: COMBATANT_TYPE.PLAYER,
      name: 'Aria',
      playerName: 'Aria',
      currentHp: 10,
      temporaryHp: 5,
    });
    await setup(createRoom({ combatants: { player_Aria: aria }, initiativeOrder: ['player_Aria'] }));
    realtimeData.clearCalls();

    await service.takeDamage('player_Aria', 7);

    expect(realtimeData.updateMock).toHaveBeenCalledWith(ROOM_PATH, expect.objectContaining({
      'combatants/player_Aria/currentHp': 8,
      'combatants/player_Aria/temporaryHp': 0,
      'combatants/player_Aria/status': COMBATANT_STATUS.ALIVE,
    }));
    expect(characterService.updatePlayerHealth).toHaveBeenCalledWith('Aria', 8, 0);
  });

  it('damages a deduplicated mixed selection in one write', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(NOW);
    const goblin = createCombatant({ id: 'goblin', currentHp: 10 });
    const aria = createCombatant({
      id: 'player_Aria',
      type: COMBATANT_TYPE.PLAYER,
      name: 'Aria',
      playerName: 'Aria',
      currentHp: 9,
    });
    await setup(createRoom({
      combatants: { goblin, player_Aria: aria },
      initiativeOrder: ['goblin', 'player_Aria'],
    }));
    realtimeData.clearCalls();

    await service.damageMany(['goblin', 'player_Aria', 'goblin', 'missing'], 4);

    expect(realtimeData.updateMock).toHaveBeenCalledOnce();
    expect(realtimeData.updateMock).toHaveBeenCalledWith(ROOM_PATH, expect.objectContaining({
      'combatants/goblin': expect.objectContaining({ currentHp: 6 }),
      'combatants/player_Aria': expect.objectContaining({ currentHp: 5 }),
      history: expect.any(Array),
    }));
    expect(characterService.updatePlayerHealth).toHaveBeenCalledWith('Aria', 5, 0);
  });

  it('replaces effects maintained by the same concentration source across targets', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(NOW);
    const first = createCombatant({
      id: 'enemy-1',
      activeEffects: [{
        id: 'old-concentration',
        type: STATUS_EFFECT_TYPE.CHARMED,
        appliedAt: 1,
        concentrationSourceId: 'player_Aria',
      }],
    });
    const second = createCombatant({ id: 'enemy-2' });
    await setup(createRoom({
      combatants: { 'enemy-1': first, 'enemy-2': second },
      initiativeOrder: ['enemy-1', 'enemy-2'],
    }));
    realtimeData.clearCalls();

    await service.addStatusEffect('enemy-2', STATUS_EFFECT_TYPE.FRIGHTENED, {
      source: 'Ария',
      concentrationSourceId: 'player_Aria',
    });

    expect(realtimeData.updateMock).toHaveBeenCalledWith(ROOM_PATH, expect.objectContaining({
      'combatants/enemy-1/activeEffects': null,
      'combatants/enemy-2/activeEffects': [expect.objectContaining({
        type: STATUS_EFFECT_TYPE.FRIGHTENED,
        source: 'Ария',
        concentrationSourceId: 'player_Aria',
      })],
    }));
  });

  it('restores a persisted reversible action after a service reload', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(NOW);
    const current = createCombatant({ id: 'enemy-1', currentHp: 4 });
    const previous = createCombatant({ id: 'enemy-1', currentHp: 10 });
    await setup(createRoom({
      combatants: { 'enemy-1': current },
      history: [{
        id: 'persisted-action',
        type: 'damage',
        targetId: 'enemy-1',
        value: 6,
        timestamp: NOW - 1,
        reversible: true,
        description: 'Goblin: −6 HP',
        undoState: { combatants: { 'enemy-1': previous } },
      }],
    }));
    realtimeData.clearCalls();

    expect(service.canUndo()).toBe(true);
    await service.undoLastAction();

    expect(realtimeData.updateMock).toHaveBeenCalledWith(ROOM_PATH, expect.objectContaining({
      'combatants/enemy-1': expect.objectContaining({ currentHp: 10 }),
      history: null,
    }));
    expect(service.canUndo()).toBe(false);
  });

  it('supports emergency current-turn selection and initiative reordering', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(NOW);
    await setup(createRoom({
      combatants: {
        'enemy-1': createCombatant({ id: 'enemy-1' }),
        'enemy-2': createCombatant({ id: 'enemy-2' }),
      },
      initiativeOrder: ['enemy-1', 'enemy-2'],
      currentTurnIndex: 0,
    }));
    realtimeData.clearCalls();

    await expect(service.setCurrentTurn('enemy-2')).resolves.toBe(true);
    expect(realtimeData.updateMock).toHaveBeenCalledWith(ROOM_PATH, expect.objectContaining({
      currentTurnIndex: 1,
      history: expect.any(Array),
    }));

    realtimeData.updateMock.mockClear();
    await expect(service.moveCombatant('enemy-2', -1)).resolves.toBe(true);
    expect(realtimeData.updateMock).toHaveBeenCalledWith(ROOM_PATH, expect.objectContaining({
      initiativeOrder: ['enemy-2', 'enemy-1'],
      currentTurnIndex: 1,
      history: expect.any(Array),
    }));
  });

  it('finishes a scene with a short rest for living players only', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(NOW);
    const aria = createCombatant({
      id: 'player_Aria',
      type: COMBATANT_TYPE.PLAYER,
      playerName: 'Aria',
      currentHp: 3,
      temporaryHp: 2,
    });
    const dead = createCombatant({
      id: 'player_Borin',
      type: COMBATANT_TYPE.PLAYER,
      playerName: 'Borin',
      currentHp: 0,
      status: COMBATANT_STATUS.DEAD,
    });
    await setup(createRoom({
      combatants: { player_Aria: aria, player_Borin: dead },
      initiativeOrder: ['player_Aria', 'player_Borin'],
    }));
    realtimeData.clearCalls();

    await service.finishScene('short-rest');

    const writtenRoom = realtimeData.setMock.mock.calls[0][1] as BattleRoom;
    expect(writtenRoom.combatants['player_Aria']).toEqual(expect.objectContaining({
      currentHp: 3,
      temporaryHp: 2,
    }));
    expect(characterService.completeShortRest).toHaveBeenCalledWith('Aria');
    expect(characterService.completeShortRest).not.toHaveBeenCalledWith('Borin');
  });
});

function createRoom(overrides: Partial<BattleRoom> = {}): BattleRoom {
  return {
    status: 'preparation',
    currentRound: 1,
    currentTurnIndex: 0,
    combatants: { 'enemy-1': createCombatant({ id: 'enemy-1' }) },
    initiativeOrder: ['enemy-1'],
    lastUpdated: 0,
    ...overrides,
  };
}

function createCombatant(overrides: Partial<Combatant> = {}): Combatant {
  return {
    id: 'enemy-1',
    type: COMBATANT_TYPE.ENEMY,
    subtype: 'goblin',
    name: 'Goblin',
    initiative: 10,
    ac: 12,
    maxHp: 10,
    currentHp: 10,
    status: COMBATANT_STATUS.ALIVE,
    ...overrides,
  };
}

function createEnemyInput(overrides: Partial<Combatant> = {}) {
  return {
    type: COMBATANT_TYPE.ENEMY,
    subtype: 'goblin',
    name: 'Goblin',
    maxHp: 10,
    ac: 15,
    actions: [],
    statuses: [],
    resistances: [],
    ...overrides,
  };
}

function createPlayer() {
  return {
    name: 'Aria',
    class: 'Wizard',
    level: 3,
    race: 'Elf',
    stats: { str: 8, dex: 14, con: 12, int: 18, wis: 13, cha: 10 },
    maxHp: 24,
    currentHp: 24,
    ac: 16,
    speed: 30,
    weapons: [],
    abilities: [],
  };
}
