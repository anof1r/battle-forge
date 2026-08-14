import { TestBed } from '@angular/core/testing';
import { FirebaseApp, deleteApp, initializeApp } from 'firebase/app';
import {
  Database,
  connectDatabaseEmulator,
  getDatabase,
  ref,
  set,
} from 'firebase/database';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { FIREBASE_DATABASE, FirebaseService } from './firebase.service';
import { LoggerService } from './logger.service';

const PROJECT_ID = 'demo-battle-forge';
const TEST_ROOT = 'integration-tests/firebase-service';

describe('FirebaseService with Realtime Database Emulator', () => {
  let app: FirebaseApp;
  let database: Database;
  let service: FirebaseService;
  let logger: { error: ReturnType<typeof vi.fn> };

  beforeAll(() => {
    app = initializeApp(
      {
        apiKey: 'demo-api-key',
        projectId: PROJECT_ID,
        databaseURL: `https://${PROJECT_ID}-default-rtdb.firebaseio.com`,
      },
      `firebase-service-tests-${Date.now()}`,
    );
    database = getDatabase(app);
    connectDatabaseEmulator(database, '127.0.0.1', 9000);
  });

  beforeEach(async () => {
    await set(ref(database, TEST_ROOT), null);
    logger = { error: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        FirebaseService,
        { provide: FIREBASE_DATABASE, useValue: database },
        { provide: LoggerService, useValue: logger },
      ],
    });
    service = TestBed.inject(FirebaseService);
  });

  afterAll(async () => {
    await deleteApp(app);
  });

  it('performs set, get, update and remove against the real SDK', async () => {
    const path = `${TEST_ROOT}/combatants/goblin-1`;

    await service.set(path, { name: 'Goblin', currentHp: 10 });
    expect(await service.get(path)).toEqual({ name: 'Goblin', currentHp: 10 });

    await service.update(path, { currentHp: 6 });
    expect(await service.get(path)).toEqual({ name: 'Goblin', currentHp: 6 });

    await service.remove(path);
    expect(await service.get(path)).toBeNull();
  });

  it('emits realtime changes and stops after unsubscribe', async () => {
    const path = `${TEST_ROOT}/room`;
    const values: Array<{ round: number } | null> = [];
    const subscription = service
      .subscribe<{ round: number }>(path)
      .subscribe((value) => values.push(value));

    await vi.waitFor(() => expect(values).toEqual([null]));
    await service.set(path, { round: 1 });
    await vi.waitFor(() => expect(values).toEqual([null, { round: 1 }]));

    subscription.unsubscribe();
    await service.set(path, { round: 2 });
    expect(values).toEqual([null, { round: 1 }]);
  });

  it('propagates denied writes and records their context', async () => {
    await expect(service.set('outside-test-scope/value', true)).rejects.toThrow();
    expect(logger.error).toHaveBeenCalledWith('FirebaseService.set', expect.anything());
  });
});
