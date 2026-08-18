import { Injectable, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  CreatureTemplate,
  CreatureTemplateDraft,
  SceneCreatureStack,
  ScenePreset,
  ScenePresetDraft,
} from '../models';
import {
  FIREBASE_ROOT,
  creatureTemplatePath,
  scenePresetPath,
} from '../constants/firebase-paths.constants';
import { FirebaseService } from './firebase.service';

@Injectable({ providedIn: 'root' })
export class SceneLibraryService {
  private readonly firebase = inject(FirebaseService);

  private readonly creatureRecords = toSignal(
    this.firebase.subscribe<Record<string, Partial<CreatureTemplate>>>(
      FIREBASE_ROOT.CREATURE_TEMPLATES,
    ),
    { initialValue: null },
  );
  private readonly sceneRecords = toSignal(
    this.firebase.subscribe<Record<string, Partial<ScenePreset>>>(FIREBASE_ROOT.SCENE_PRESETS),
    { initialValue: null },
  );

  readonly creatures = computed(() =>
    Object.entries(this.creatureRecords() ?? {})
      .map(([id, creature]) => this.normalizeCreature(id, creature))
      .sort((a, b) => a.name.localeCompare(b.name)),
  );
  readonly scenes = computed(() =>
    Object.entries(this.sceneRecords() ?? {})
      .map(([id, scene]) => this.normalizeScene(id, scene))
      .sort((a, b) => a.name.localeCompare(b.name)),
  );

  async saveCreature(draft: CreatureTemplateDraft): Promise<string> {
    const now = Date.now();
    const id = draft.id || `creature_${crypto.randomUUID()}`;
    const existing = this.creatureRecords()?.[id];
    const creature: CreatureTemplate = {
      ...draft,
      id,
      createdAt: existing?.createdAt ?? now,
      lastUpdated: now,
    };
    await this.firebase.set(creatureTemplatePath(id), creature);
    return id;
  }

  async deleteCreature(templateId: string): Promise<boolean> {
    if (this.scenes().some((scene) => scene.entries.some((entry) => entry.templateId === templateId))) {
      return false;
    }
    await this.firebase.remove(creatureTemplatePath(templateId));
    return true;
  }

  async saveScene(draft: ScenePresetDraft): Promise<string> {
    const now = Date.now();
    const id = draft.id || `scene_${crypto.randomUUID()}`;
    const existing = this.sceneRecords()?.[id];
    const scene: ScenePreset = {
      ...draft,
      entries: draft.entries.map((entry) => {
        const quantity = Number.isFinite(entry.quantity) ? Math.floor(entry.quantity) : 1;
        return { templateId: entry.templateId, quantity: Math.max(1, quantity) };
      }),
      id,
      createdAt: existing?.createdAt ?? now,
      lastUpdated: now,
    };
    await this.firebase.set(scenePresetPath(id), scene);
    return id;
  }

  async deleteScene(sceneId: string): Promise<void> {
    await this.firebase.remove(scenePresetPath(sceneId));
  }

  resolveScene(sceneId: string): SceneCreatureStack[] | null {
    const scene = this.scenes().find((candidate) => candidate.id === sceneId);
    if (!scene) return null;
    const creatures = new Map(this.creatures().map((creature) => [creature.id, creature]));
    return scene.entries.flatMap((entry) => {
      const template = creatures.get(entry.templateId);
      return template ? [{ template, quantity: Math.max(1, entry.quantity) }] : [];
    });
  }

  private normalizeCreature(id: string, creature: Partial<CreatureTemplate>): CreatureTemplate {
    return {
      id: creature.id ?? id,
      name: creature.name ?? 'Существо без имени',
      subtype: creature.subtype ?? '',
      maxHp: creature.maxHp ?? 1,
      ac: creature.ac ?? 1,
      actions: Array.isArray(creature.actions) ? creature.actions : [],
      abilities: Array.isArray(creature.abilities) ? creature.abilities : [],
      resistances: Array.isArray(creature.resistances) ? creature.resistances : [],
      statuses: Array.isArray(creature.statuses) ? creature.statuses : [],
      ...(creature.source ? { source: creature.source } : {}),
      createdAt: creature.createdAt ?? creature.lastUpdated ?? 0,
      lastUpdated: creature.lastUpdated ?? 0,
    };
  }

  private normalizeScene(id: string, scene: Partial<ScenePreset>): ScenePreset {
    return {
      id: scene.id ?? id,
      name: scene.name ?? 'Сцена без названия',
      description: scene.description ?? '',
      entries: Array.isArray(scene.entries) ? scene.entries : [],
      createdAt: scene.createdAt ?? scene.lastUpdated ?? 0,
      lastUpdated: scene.lastUpdated ?? 0,
    };
  }
}
