import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CreatureTemplate, ScenePreset } from '../../../core/models';
import { BattleService } from '../../../core/services/battle.service';
import { LoggerService } from '../../../core/services/logger.service';
import { SceneLibraryService } from '../../../core/services/scene-library.service';
import { EnemyActionLibraryService } from '../../../core/services/enemy-action-library.service';
import { DmSceneLibraryComponent } from './dm-scene-library.component';

describe('DmSceneLibraryComponent', () => {
  let fixture: ComponentFixture<DmSceneLibraryComponent>;
  let component: DmSceneLibraryComponent;
  let library: {
    creatures: ReturnType<typeof signal<CreatureTemplate[]>>;
    scenes: ReturnType<typeof signal<ScenePreset[]>>;
    saveCreature: ReturnType<typeof vi.fn>;
    deleteCreature: ReturnType<typeof vi.fn>;
    saveScene: ReturnType<typeof vi.fn>;
    deleteScene: ReturnType<typeof vi.fn>;
    resolveScene: ReturnType<typeof vi.fn>;
  };
  let battle: { addCreatureStacks: ReturnType<typeof vi.fn> };
  let logger: { error: ReturnType<typeof vi.fn> };
  const savedActions = signal([
    {
      id: 'weapon-open5e-longsword',
      name: 'Длинный меч',
      description: 'Воинское оружие',
      toHit: '+4',
      damage: '1d8 + 2',
      damageType: 'рубящий',
      fullText: '',
      source: {
        provider: 'open5e' as const,
        key: 'longsword',
        documentKey: 'srd-2024',
        documentName: 'SRD 2024',
        permalink: '',
        originalName: 'Longsword',
        originalDescription: '',
        importedAt: 100,
      },
      createdAt: 100,
      lastUpdated: 100,
    },
  ]);

  const goblin: CreatureTemplate = {
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
  };

  const forest: ScenePreset = {
    id: 'scene-forest',
    name: 'Forest Ambush',
    description: 'Near the fallen tree',
    entries: [{ templateId: goblin.id, quantity: 3 }],
    createdAt: 100,
    lastUpdated: 100,
  };

  const wolf: CreatureTemplate = {
    ...goblin,
    id: 'creature-wolf',
    name: 'Wolf',
    subtype: 'beast',
  };

  beforeEach(() => {
    library = {
      creatures: signal([goblin]),
      scenes: signal([forest]),
      saveCreature: vi.fn().mockResolvedValue(goblin.id),
      deleteCreature: vi.fn().mockResolvedValue(true),
      saveScene: vi.fn().mockResolvedValue(forest.id),
      deleteScene: vi.fn().mockResolvedValue(undefined),
      resolveScene: vi.fn().mockReturnValue([{ template: goblin, quantity: 3 }]),
    };
    battle = { addCreatureStacks: vi.fn().mockResolvedValue(['one', 'two', 'three']) };
    logger = { error: vi.fn() };

    TestBed.configureTestingModule({
      imports: [DmSceneLibraryComponent],
      providers: [
        { provide: SceneLibraryService, useValue: library },
        { provide: BattleService, useValue: battle },
        { provide: LoggerService, useValue: logger },
        { provide: EnemyActionLibraryService, useValue: { actions: savedActions } },
      ],
    });
    fixture = TestBed.createComponent(DmSceneLibraryComponent);
    component = fixture.componentInstance;
  });

  it('builds and saves a reusable creature with manual attacks and abilities', async () => {
    component.creatureName.set('Goblin Scout');
    component.creatureSubtype.set('goblin');
    component.creatureMaxHp.set(14);
    component.creatureAc.set(13);
    component.actionName.set('Shortbow');
    component.actionToHit.set('+4');
    component.actionDamage.set('1d6 + 2');
    component.actionDamageType.set('piercing');
    component.addAction();
    component.abilityName.set('Nimble Escape');
    component.abilityDescription.set('Can Hide as a bonus action.');
    component.addAbility();

    component.saveCreature();

    await vi.waitFor(() =>
      expect(library.saveCreature).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Goblin Scout',
          maxHp: 14,
          actions: [expect.objectContaining({ name: 'Shortbow', damage: '1d6 + 2' })],
          abilities: [{ name: 'Nimble Escape', description: 'Can Hide as a bonus action.' }],
        }),
      ),
    );
    await vi.waitFor(() => expect(component.savingCreature()).toBe(false));
    expect(component.creatureName()).toBe('');
  });

  it('adds a saved Open5e weapon to the creature editor', () => {
    component.selectedActionTemplateId.set('weapon-open5e-longsword');
    component.addSavedAction();

    expect(component.creatureActions()).toEqual([
      expect.objectContaining({ name: 'Длинный меч', damage: '1d8 + 2' }),
    ]);
    expect(component.selectedActionTemplateId()).toBe('');
  });

  it('merges duplicate creatures in a scene and saves the preset', async () => {
    component.sceneName.set('Forest Ambush');
    component.selectedTemplateId.set(goblin.id);
    component.selectedQuantity.set(2);
    component.addSceneEntry();
    component.selectedTemplateId.set(goblin.id);
    component.selectedQuantity.set(3);
    component.addSceneEntry();

    expect(component.sceneEntries()).toEqual([{ templateId: goblin.id, quantity: 5 }]);
    component.saveScene();

    await vi.waitFor(() =>
      expect(library.saveScene).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Forest Ambush',
          entries: [{ templateId: goblin.id, quantity: 5 }],
        }),
      ),
    );
  });

  it('updates an existing scene after adding a newly available creature', async () => {
    component.editScene(forest);
    library.creatures.set([goblin, wolf]);
    component.selectedTemplateId.set(wolf.id);
    component.selectedQuantity.set(2);
    component.addSceneEntry();

    component.saveScene();

    await vi.waitFor(() =>
      expect(library.saveScene).toHaveBeenCalledWith({
        id: forest.id,
        name: forest.name,
        description: forest.description,
        entries: [
          { templateId: goblin.id, quantity: 3 },
          { templateId: wolf.id, quantity: 2 },
        ],
      }),
    );
    await vi.waitFor(() => expect(component.savingScene()).toBe(false));
    expect(component.feedback()).toContain('обновлён');
  });

  it('renders saved scenes and launches all resolved creature stacks', async () => {
    fixture.detectChanges();

    expect(fixture.nativeElement).toHaveTextContent('Forest Ambush');
    expect(fixture.nativeElement).toHaveTextContent('Goblin ×3');
    const launch = Array.from<HTMLButtonElement>(fixture.nativeElement.querySelectorAll('button')).find(
      (button) => button.textContent?.includes('Добавить сцену в бой'),
    );
    launch?.click();

    await vi.waitFor(() =>
      expect(battle.addCreatureStacks).toHaveBeenCalledWith([{ template: goblin, quantity: 3 }]),
    );
    expect(component.feedback()).toContain('3 существ');
  });

  it('preserves creature form data and reports save failures', async () => {
    const error = new Error('write failed');
    library.saveCreature.mockRejectedValue(error);
    component.creatureName.set('Goblin');

    component.saveCreature();

    await vi.waitFor(() =>
      expect(logger.error).toHaveBeenCalledWith('DmSceneLibraryComponent.saveCreature', error),
    );
    expect(component.creatureName()).toBe('Goblin');
    expect(component.error()).not.toBeNull();
  });

  it('can edit legacy creatures whose empty collections were omitted by Firebase', () => {
    const legacy = {
      ...goblin,
      actions: undefined,
      abilities: undefined,
      resistances: undefined,
      statuses: undefined,
    } as unknown as CreatureTemplate;

    expect(() => component.editCreature(legacy)).not.toThrow();
    expect(component.creatureActions()).toEqual([]);
    expect(component.creatureAbilities()).toEqual([]);
    expect(component.creatureResistances()).toBe('');
    expect(component.creatureStatuses()).toBe('');
  });
});
