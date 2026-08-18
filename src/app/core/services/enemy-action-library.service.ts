import { Injectable, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  FIREBASE_ROOT,
  enemyActionTemplatePath,
} from '../constants/firebase-paths.constants';
import { EnemyActionTemplate, EnemyActionTemplateDraft } from '../models';
import { FirebaseService } from './firebase.service';

@Injectable({ providedIn: 'root' })
export class EnemyActionLibraryService {
  private readonly firebase = inject(FirebaseService);
  private readonly records = toSignal(
    this.firebase.subscribe<Record<string, Partial<EnemyActionTemplate>>>(
      FIREBASE_ROOT.ENEMY_ACTION_TEMPLATES,
    ),
    { initialValue: null },
  );

  readonly actions = computed(() =>
    Object.entries(this.records() ?? {})
      .map(([id, action]) => this.normalize(id, action))
      .sort((a, b) => a.name.localeCompare(b.name)),
  );

  async saveAction(draft: EnemyActionTemplateDraft): Promise<string> {
    const now = Date.now();
    const existing = this.records()?.[draft.id];
    const action: EnemyActionTemplate = {
      ...draft,
      createdAt: existing?.createdAt ?? now,
      lastUpdated: now,
    };
    await this.firebase.set(enemyActionTemplatePath(draft.id), action);
    return draft.id;
  }

  async deleteAction(id: string): Promise<void> {
    await this.firebase.remove(enemyActionTemplatePath(id));
  }

  private normalize(id: string, action: Partial<EnemyActionTemplate>): EnemyActionTemplate {
    return {
      id: action.id ?? id,
      name: action.name ?? 'Атака без названия',
      description: action.description ?? '',
      toHit: action.toHit ?? '',
      damage: action.damage ?? '',
      damageType: action.damageType ?? '',
      fullText: action.fullText ?? '',
      source: action.source ?? {
        provider: 'open5e',
        key: '',
        documentKey: '',
        documentName: 'Неизвестный источник',
        permalink: '',
        originalName: action.name ?? '',
        originalDescription: action.description ?? '',
        importedAt: action.createdAt ?? 0,
      },
      createdAt: action.createdAt ?? action.lastUpdated ?? 0,
      lastUpdated: action.lastUpdated ?? 0,
    };
  }
}
