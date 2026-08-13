import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { BattleService } from '../battle.service';
import { FirebaseService } from '../firebase.service';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';
import { BattleRoom, Combatant } from '../../models';
import { PlayerComponent } from '../../../features/player/player.component';

const mockFirebaseService = {
  get: vi.fn().mockResolvedValue(createTestRoom()),
  set: vi.fn().mockResolvedValue(undefined),
  update: vi.fn().mockResolvedValue(undefined),
  remove: vi.fn().mockResolvedValue(undefined),
  subscribe: vi.fn().mockReturnValue(of(createTestRoom())),
};

describe('BattleService', () => {
  let service: BattleService;
  let firebaseService: FirebaseService;

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [BattleService, { provide: FirebaseService, useValue: mockFirebaseService }],
      imports: [PlayerComponent],
    });
    service = TestBed.inject(BattleService);
    firebaseService = TestBed.inject(FirebaseService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('addEnemy', () => {
    it('should send correct enemy structure to Firebase', async () => {
      const enemyInput = createTestEnemy({ name: 'Orc', maxHp: 15 });

      await service.addEnemy(enemyInput);

      expect(firebaseService.set).toHaveBeenCalled();
      const [path, data] = (firebaseService.set as Mock).mock.calls[0] as [string, Combatant];
      expect(path).toMatch(/^rooms\/main-room\/combatants\/enemy_/);
      expect(data).toMatchObject({
        type: 'enemy',
        subtype: 'goblin',
        name: 'Orc',
        maxHp: 15,
        currentHp: 15,
        ac: 15,
        status: 'alive',
        initiative: 0,
      });
      expect(data.id).toMatch(/^enemy_/);
    });
  });

  describe('takeDamage', () => {
    it('should update HP and log action', async () => {
      await service.takeDamage('enemy-1', 4);

      expect(firebaseService.update).toHaveBeenCalled();
      const [, updates] = (firebaseService.update as Mock).mock.calls[0] as [
        string,
        Record<string, unknown>,
      ];
      expect(updates['currentHp']).toBe(6);
    });
  });
});

function createTestRoom(): BattleRoom {
  return {
    status: 'preparation',
    currentRound: 1,
    currentTurnIndex: 0,
    combatants: {
      'enemy-1': {
        id: 'enemy-1',
        type: 'enemy',
        subtype: 'goblin',
        name: 'Goblin',
        initiative: 0,
        ac: 10,
        maxHp: 10,
        currentHp: 10,
        status: 'alive',
      },
    },
    initiativeOrder: ['enemy-1'],
    lastUpdated: 0,
  };
}

function createTestEnemy(overrides: Partial<Combatant> = {}) {
  return {
    name: 'Goblin',
    type: 'enemy' as const,
    subtype: 'goblin',
    maxHp: 10,
    ac: 15,
    actions: [],
    statuses: [],
    resistances: [],
    ...overrides,
  };
}
