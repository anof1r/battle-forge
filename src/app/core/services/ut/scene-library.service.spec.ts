import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FIREBASE_ROOT } from '../../constants/firebase-paths.constants';
import { CreatureTemplate, EnemyAction, ScenePreset, ScenePresetEntry } from '../../models';
import { FirebaseService } from '../firebase.service';
import { SceneLibraryService } from '../scene-library.service';

describe('SceneLibraryService', () => {
  let service: SceneLibraryService;
  let firebase: {
    set: ReturnType<typeof vi.fn>;
    remove: ReturnType<typeof vi.fn>;
    subscribe: ReturnType<typeof vi.fn>;
  };

  const creature = (overrides: Partial<CreatureTemplate> = {}): CreatureTemplate => ({
    id: 'creature-goblin',
    name: 'Goblin',
    subtype: 'goblin',
    maxHp: 10,
    ac: 12,
    actions: [],
    abilities: [],
    resistances: [],
    statuses: [],
    createdAt: 100,
    lastUpdated: 100,
    ...overrides,
  });

  const scene = (overrides: Partial<ScenePreset> = {}): ScenePreset => ({
    id: 'scene-forest',
    name: 'Forest Ambush',
    description: '',
    entries: [{ templateId: 'creature-goblin', quantity: 3 }],
    createdAt: 100,
    lastUpdated: 100,
    ...overrides,
  });

  function setup(
    creatures: Record<string, CreatureTemplate> | null = null,
    scenes: Record<string, ScenePreset> | null = null,
  ): void {
    firebase = {
      set: vi.fn().mockResolvedValue(undefined),
      remove: vi.fn().mockResolvedValue(undefined),
      subscribe: vi.fn((path: string) =>
        path === FIREBASE_ROOT.CREATURE_TEMPLATES ? of(creatures) : of(scenes),
      ),
    };
    TestBed.configureTestingModule({
      providers: [
        SceneLibraryService,
        { provide: FirebaseService, useValue: firebase },
      ],
    });
    service = TestBed.inject(SceneLibraryService);
  }

  beforeEach(() => {
    vi.spyOn(Date, 'now').mockReturnValue(500);
  });

  it('projects sorted realtime creatures and scenes and resolves scene references', () => {
    const goblin = creature();
    const wolf = creature({ id: 'creature-wolf', name: 'Dire Wolf', subtype: 'beast' });
    const forest = scene({
      entries: [
        { templateId: goblin.id, quantity: 3 },
        { templateId: wolf.id, quantity: 1 },
      ],
    });
    setup({ [goblin.id]: goblin, [wolf.id]: wolf }, { [forest.id]: forest });

    expect(service.creatures().map((item) => item.name)).toEqual(['Dire Wolf', 'Goblin']);
    expect(service.resolveScene(forest.id)).toEqual([
      { template: goblin, quantity: 3 },
      { template: wolf, quantity: 1 },
    ]);
    expect(service.resolveScene('missing')).toBeNull();
  });

  it('normalizes collections omitted by Firebase for otherwise empty creature data', () => {
    const legacy = {
      id: 'creature-empty',
      name: 'Empty Creature',
      subtype: 'construct',
      maxHp: 8,
      ac: 11,
      createdAt: 100,
      lastUpdated: 100,
    } as CreatureTemplate;
    setup({ [legacy.id]: legacy });

    expect(service.creatures()).toEqual([
      expect.objectContaining({
        id: legacy.id,
        actions: [],
        abilities: [],
        resistances: [],
        statuses: [],
      }),
    ]);
  });

  it('creates and updates creature templates with stable creation timestamps', async () => {
    const existing = creature();
    setup({ [existing.id]: existing });
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('00000000-0000-4000-8000-000000000010');

    await expect(
      service.saveCreature({
        name: 'Wolf',
        subtype: 'beast',
        maxHp: 11,
        ac: 13,
        actions: [],
        abilities: [],
        resistances: [],
        statuses: [],
      }),
    ).resolves.toBe('creature_00000000-0000-4000-8000-000000000010');
    expect(firebase.set).toHaveBeenLastCalledWith(
      'dm-library/creatures/creature_00000000-0000-4000-8000-000000000010',
      expect.objectContaining({ createdAt: 500, lastUpdated: 500 }),
    );

    await service.saveCreature({ ...existing, name: 'Goblin Boss' });
    expect(firebase.set).toHaveBeenLastCalledWith(
      `dm-library/creatures/${existing.id}`,
      expect.objectContaining({ name: 'Goblin Boss', createdAt: 100, lastUpdated: 500 }),
    );
  });

  it('normalizes scene quantities and prevents deleting referenced creatures', async () => {
    const goblin = creature();
    const forest = scene();
    setup({ [goblin.id]: goblin }, { [forest.id]: forest });

    await expect(service.deleteCreature(goblin.id)).resolves.toBe(false);
    expect(firebase.remove).not.toHaveBeenCalled();

    await service.saveScene({
      id: forest.id,
      name: forest.name,
      description: forest.description,
      entries: [{ templateId: goblin.id, quantity: 0 }],
    });
    expect(firebase.set).toHaveBeenCalledWith(
      `dm-library/scenes/${forest.id}`,
      expect.objectContaining({
        createdAt: 100,
        lastUpdated: 500,
        entries: [{ templateId: goblin.id, quantity: 1 }],
      }),
    );
  });

  it('removes malformed legacy values before updating a scene or creature', async () => {
    const goblin = creature();
    const wolf = creature({ id: 'creature-wolf', name: 'Wolf' });
    const forest = scene();
    setup({ [goblin.id]: goblin, [wolf.id]: wolf }, { [forest.id]: forest });

    await service.saveScene({
      id: forest.id,
      name: forest.name,
      description: forest.description,
      entries: [
        { templateId: goblin.id, quantity: 2 },
        null,
        { templateId: undefined, quantity: 1 },
        { templateId: wolf.id, quantity: 1 },
      ] as unknown as ScenePresetEntry[],
    });

    expect(firebase.set).toHaveBeenLastCalledWith(
      `dm-library/scenes/${forest.id}`,
      expect.objectContaining({
        entries: [
          { templateId: goblin.id, quantity: 2 },
          { templateId: wolf.id, quantity: 1 },
        ],
      }),
    );

    await service.saveCreature({
      ...goblin,
      actions: [
        {
          name: ' Bite ',
          description: undefined,
          toHit: undefined,
          damage: '1d4',
          damageType: undefined,
          fullText: undefined,
        } as unknown as EnemyAction,
      ],
    });

    expect(firebase.set).toHaveBeenLastCalledWith(
      `dm-library/creatures/${goblin.id}`,
      expect.objectContaining({
        actions: [
          {
            name: 'Bite',
            description: '',
            toHit: '',
            damage: '1d4',
            damageType: '',
          },
        ],
      }),
    );
  });

  it('deletes unreferenced creatures and saved scenes', async () => {
    const goblin = creature();
    const forest = scene({ entries: [] });
    setup({ [goblin.id]: goblin }, { [forest.id]: forest });

    await expect(service.deleteCreature(goblin.id)).resolves.toBe(true);
    await service.deleteScene(forest.id);

    expect(firebase.remove).toHaveBeenNthCalledWith(1, `dm-library/creatures/${goblin.id}`);
    expect(firebase.remove).toHaveBeenNthCalledWith(2, `dm-library/scenes/${forest.id}`);
  });
});
