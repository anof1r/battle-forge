import { TestBed } from '@angular/core/testing';
import { Observable, ReplaySubject } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { COMBATANT_STATUS, COMBATANT_TYPE } from '../../constants';
import { BattleRoom, Combatant } from '../../models';
import { BattleService } from '../battle.service';
import { CharacterService } from '../character.service';
import { DamageCalculationService } from '../damage-calculation.service';
import { FirebaseService } from '../firebase.service';
import { InitiativeService } from '../initiative.service';

const ROOM_PATH = 'rooms/main-room';
const UUID = '00000000-0000-4000-8000-000000000001';
const NOW = 1_700_000_000_000;

class FirebaseServiceFake
  implements Pick<FirebaseService, 'get' | 'set' | 'update' | 'remove' | 'subscribe'>
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
  let firebase: FirebaseServiceFake;
  let room$: ReplaySubject<BattleRoom | null>;
  let characterService: { updatePlayerHp: ReturnType<typeof vi.fn> };
  let initiativeService: {
    sortByInitiative: ReturnType<typeof vi.fn>;
    setInitiative: ReturnType<typeof vi.fn>;
  };

  async function setup(initialRoom: BattleRoom | null = createRoom()): Promise<void> {
    room$ = new ReplaySubject<BattleRoom | null>(1);
    room$.next(initialRoom);
    firebase = new FirebaseServiceFake(room$.asObservable(), initialRoom);
    characterService = { updatePlayerHp: vi.fn().mockResolvedValue(undefined) };
    initiativeService = {
      sortByInitiative: vi.fn().mockResolvedValue(undefined),
      setInitiative: vi.fn().mockResolvedValue(undefined),
    };

    TestBed.configureTestingModule({
      providers: [
        BattleService,
        DamageCalculationService,
        { provide: FirebaseService, useValue: firebase },
        { provide: CharacterService, useValue: characterService },
        { provide: InitiativeService, useValue: initiativeService },
      ],
    });
    service = TestBed.inject(BattleService);
    await vi.waitFor(() => expect(firebase.getMock).toHaveBeenCalledWith(ROOM_PATH));
  }

  it('creates an empty room when Firebase has no room yet', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(NOW);
    await setup(null);

    await vi.waitFor(() => expect(firebase.setMock).toHaveBeenCalledOnce());
    expect(firebase.setMock).toHaveBeenCalledWith(ROOM_PATH, {
      status: 'preparation',
      currentRound: 1,
      currentTurnIndex: 0,
      combatants: {},
      initiativeOrder: [],
      lastUpdated: NOW,
    });
  });

  it('recomputes battle projections when Firebase emits a new room', async () => {
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
    firebase.clearCalls();

    const id = await service.addEnemy(createEnemyInput({ name: 'Orc', maxHp: 15 }));

    expect(id).toBe(`enemy_${UUID}`);
    expect(firebase.setMock).toHaveBeenCalledOnce();
    expect(firebase.setMock).toHaveBeenCalledWith(`${ROOM_PATH}/combatants/enemy_${UUID}`, {
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
    expect(firebase.updateMock).toHaveBeenCalledOnce();
    expect(firebase.updateMock).toHaveBeenCalledWith(ROOM_PATH, {
      initiativeOrder: ['enemy-1', `enemy_${UUID}`],
      lastUpdated: NOW,
    });
  });

  it('damages an enemy, records undo state and restores previous HP', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(NOW);
    vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue(UUID);
    await setup();
    firebase.clearCalls();

    await service.takeDamage('enemy-1', 4);

    expect(firebase.updateMock).toHaveBeenCalledWith(`${ROOM_PATH}/combatants/enemy-1`, {
      currentHp: 6,
      lastUpdated: NOW,
    });
    expect(service.canUndo()).toBe(true);
    expect(characterService.updatePlayerHp).not.toHaveBeenCalled();

    await service.undoLastAction();
    expect(firebase.updateMock).toHaveBeenLastCalledWith(`${ROOM_PATH}/combatants/enemy-1`, {
      currentHp: 10,
      lastUpdated: NOW,
    });
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
    firebase.clearCalls();

    await service.takeDamage('player-aria', 10);

    expect(firebase.updateMock).toHaveBeenCalledWith(`${ROOM_PATH}/combatants/player-aria`, {
      currentHp: 0,
      lastUpdated: NOW,
    });
    expect(characterService.updatePlayerHp).toHaveBeenCalledOnce();
    expect(characterService.updatePlayerHp).toHaveBeenCalledWith('Aria', 0);
  });

  it('does nothing when damage target does not exist', async () => {
    await setup();
    firebase.clearCalls();

    await service.takeDamage('missing', 5);

    expect(firebase.updateMock).not.toHaveBeenCalled();
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
    firebase.clearCalls();

    await service.damageAll(3);

    expect(firebase.updateMock).toHaveBeenCalledOnce();
    expect(firebase.updateMock).toHaveBeenCalledWith(ROOM_PATH, {
      'combatants/enemy-1/currentHp': 7,
      'combatants/enemy-1/lastUpdated': NOW,
    });
    expect(service.canUndo()).toBe(true);
  });

  it('starts a new round after the last combatant turn', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(NOW);
    await setup(createRoom({ currentRound: 3, currentTurnIndex: 0 }));
    firebase.clearCalls();

    await service.nextTurn();

    expect(firebase.updateMock).toHaveBeenCalledWith(ROOM_PATH, {
      currentTurnIndex: 0,
      currentRound: 4,
      lastUpdated: NOW,
    });
  });

  it('advances to the next combatant without incrementing the round', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(NOW);
    await setup(
      createRoom({
        currentRound: 3,
        currentTurnIndex: 0,
        combatants: {
          'enemy-1': createCombatant({ id: 'enemy-1' }),
          'enemy-2': createCombatant({ id: 'enemy-2' }),
        },
        initiativeOrder: ['enemy-1', 'enemy-2'],
      }),
    );
    firebase.clearCalls();

    await service.nextTurn();

    expect(firebase.updateMock).toHaveBeenCalledWith(ROOM_PATH, {
      currentTurnIndex: 1,
      currentRound: 3,
      lastUpdated: NOW,
    });
  });

  it('updates an existing enemy and ignores an unknown enemy', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(NOW);
    await setup();
    firebase.clearCalls();

    await service.updateEnemy('enemy-1', { ac: 18 });
    expect(firebase.updateMock).toHaveBeenCalledWith(`${ROOM_PATH}/combatants/enemy-1`, {
      ac: 18,
      lastUpdated: NOW,
    });

    firebase.updateMock.mockClear();
    await service.updateEnemy('missing', { ac: 99 });
    expect(firebase.updateMock).not.toHaveBeenCalled();
  });

  it('removes an enemy from both combatants and initiative order', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(NOW);
    await setup();
    firebase.clearCalls();

    await service.removeEnemy('enemy-1');

    expect(firebase.removeMock).toHaveBeenCalledWith(`${ROOM_PATH}/combatants/enemy-1`);
    expect(firebase.updateMock).toHaveBeenCalledWith(ROOM_PATH, {
      initiativeOrder: [],
      lastUpdated: NOW,
    });
  });

  it('adds a player once and appends them to initiative order', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(NOW);
    await setup();
    firebase.clearCalls();
    const player = { ...createPlayer(), currentHp: 9 };

    await service.addPlayerToBattle(player, 17);

    expect(firebase.setMock).toHaveBeenCalledWith(`${ROOM_PATH}/combatants/player_Aria`, {
      id: 'player_Aria',
      type: 'player',
      name: 'Aria',
      initiative: 17,
      ac: 16,
      maxHp: 24,
      currentHp: 9,
      status: 'alive',
      playerName: 'Aria',
      emoji: '🧙',
      lastUpdated: NOW,
    });
    expect(firebase.updateMock).toHaveBeenCalledWith(ROOM_PATH, {
      initiativeOrder: ['enemy-1', 'player_Aria'],
      lastUpdated: NOW,
    });
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
    firebase.clearCalls();

    await service.addPlayerToBattle(createPlayer(), 17);

    expect(firebase.setMock).not.toHaveBeenCalled();
    expect(firebase.updateMock).not.toHaveBeenCalled();
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
    firebase.clearCalls();

    await service.addPlayerToBattle(createPlayer(), 17);

    expect(firebase.setMock).not.toHaveBeenCalled();
    expect(firebase.updateMock).toHaveBeenCalledWith(ROOM_PATH, {
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
    firebase.clearCalls();

    await service.heal('enemy-1', 10);

    expect(firebase.updateMock).toHaveBeenCalledWith(`${ROOM_PATH}/combatants/enemy-1`, {
      currentHp: 10,
      lastUpdated: NOW,
    });
    expect(service.canUndo()).toBe(true);
  });

  it('delegates initiative operations and moves the room into initiative state', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(NOW);
    await setup();
    firebase.clearCalls();

    await service.setInitiative('enemy-1', 19);
    await service.sortInitiative();
    await service.rollInitiative();

    expect(initiativeService.setInitiative).toHaveBeenCalledWith(ROOM_PATH, 'enemy-1', 19);
    expect(initiativeService.sortByInitiative).toHaveBeenCalledTimes(2);
    expect(initiativeService.sortByInitiative).toHaveBeenCalledWith(
      ROOM_PATH,
      service.combatants(),
    );
    expect(firebase.updateMock).toHaveBeenCalledWith(ROOM_PATH, {
      status: 'initiative',
      currentRound: 1,
      currentTurnIndex: 0,
      lastUpdated: NOW,
    });
  });

  it('writes battle lifecycle states and resets local undo history', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(NOW);
    vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue(UUID);
    await setup();
    firebase.clearCalls();
    await service.takeDamage('enemy-1', 1);
    expect(service.canUndo()).toBe(true);

    await service.startBattle();
    await service.endBattle();
    await service.resetScene();

    expect(firebase.updateMock).toHaveBeenCalledWith(ROOM_PATH, {
      status: 'battle',
      lastUpdated: NOW,
    });
    expect(firebase.updateMock).toHaveBeenCalledWith(ROOM_PATH, {
      status: 'ended',
      lastUpdated: NOW,
    });
    expect(firebase.setMock).toHaveBeenCalledWith(
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
