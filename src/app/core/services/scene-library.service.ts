import { Injectable, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  CreatureTemplate,
  CreatureTemplateDraft,
  EnemyAbility,
  EnemyAction,
  SceneCreatureStack,
  ScenePreset,
  ScenePresetDraft,
  ScenePresetEntry,
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
    const source = draft.source ?? existing?.source;
    const creature: CreatureTemplate = {
      id,
      name: draft.name.trim() || 'Существо без имени',
      subtype: draft.subtype.trim(),
      maxHp: this.positiveInteger(draft.maxHp),
      ac: this.positiveInteger(draft.ac),
      actions: this.normalizeActions(draft.actions),
      abilities: this.normalizeAbilities(draft.abilities),
      resistances: this.normalizeStringList(draft.resistances),
      statuses: this.normalizeStringList(draft.statuses),
      ...(source ? { source } : {}),
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
      id,
      name: draft.name.trim() || 'Сцена без названия',
      description: draft.description.trim(),
      entries: this.normalizeSceneEntries(draft.entries),
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
      maxHp: this.positiveInteger(creature.maxHp),
      ac: this.positiveInteger(creature.ac),
      actions: this.normalizeActions(creature.actions),
      abilities: this.normalizeAbilities(creature.abilities),
      resistances: this.normalizeStringList(creature.resistances),
      statuses: this.normalizeStringList(creature.statuses),
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
      entries: this.normalizeSceneEntries(scene.entries),
      createdAt: scene.createdAt ?? scene.lastUpdated ?? 0,
      lastUpdated: scene.lastUpdated ?? 0,
    };
  }

  private normalizeSceneEntries(entries: unknown): ScenePresetEntry[] {
    const candidates = Array.isArray(entries)
      ? entries
      : entries && typeof entries === 'object'
        ? Object.values(entries)
        : [];
    const quantities = new Map<string, number>();

    for (const candidate of candidates) {
      if (!candidate || typeof candidate !== 'object') continue;
      const entry = candidate as Partial<ScenePresetEntry>;
      const templateId = typeof entry.templateId === 'string' ? entry.templateId.trim() : '';
      if (!templateId) continue;
      quantities.set(
        templateId,
        (quantities.get(templateId) ?? 0) + this.positiveInteger(entry.quantity),
      );
    }

    return Array.from(quantities, ([templateId, quantity]) => ({ templateId, quantity }));
  }

  private normalizeActions(actions: unknown): EnemyAction[] {
    if (!Array.isArray(actions)) return [];
    return actions.flatMap((candidate) => {
      if (!candidate || typeof candidate !== 'object') return [];
      const action = candidate as Partial<EnemyAction>;
      const name = typeof action.name === 'string' ? action.name.trim() : '';
      if (!name) return [];
      const fullText = typeof action.fullText === 'string' ? action.fullText.trim() : '';
      return [{
        name,
        description: typeof action.description === 'string' ? action.description.trim() : '',
        toHit: typeof action.toHit === 'string' ? action.toHit.trim() : '',
        damage: typeof action.damage === 'string' ? action.damage.trim() : '',
        damageType: typeof action.damageType === 'string' ? action.damageType.trim() : '',
        ...(fullText ? { fullText } : {}),
      }];
    });
  }

  private normalizeAbilities(abilities: unknown): EnemyAbility[] {
    if (!Array.isArray(abilities)) return [];
    return abilities.flatMap((candidate) => {
      if (!candidate || typeof candidate !== 'object') return [];
      const ability = candidate as Partial<EnemyAbility>;
      const name = typeof ability.name === 'string' ? ability.name.trim() : '';
      const description = typeof ability.description === 'string'
        ? ability.description.trim()
        : '';
      return name && description ? [{ name, description }] : [];
    });
  }

  private normalizeStringList(values: unknown): string[] {
    return Array.isArray(values)
      ? values.filter((value): value is string => typeof value === 'string')
          .map((value) => value.trim())
          .filter(Boolean)
      : [];
  }

  private positiveInteger(value: unknown): number {
    const number = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(number) && number > 0 ? Math.floor(number) : 1;
  }
}
