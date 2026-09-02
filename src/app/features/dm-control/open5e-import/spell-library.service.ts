import { Injectable, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { DATA_ROOT, spellTemplatePath } from '../../../core/constants/data-paths.constants';
import { SpellTemplate, SpellTemplateDraft } from '../../../core/models';
import { RealtimeDataService } from '../../../core/services/realtime-data.service';

@Injectable({ providedIn: 'root' })
export class SpellLibraryService {
  private readonly realtimeData = inject(RealtimeDataService);
  private readonly records = toSignal(
    this.realtimeData.subscribe<Record<string, Partial<SpellTemplate>>>(DATA_ROOT.SPELL_TEMPLATES),
    { initialValue: null },
  );

  readonly spells = computed(() =>
    Object.entries(this.records() ?? {})
      .map(([id, spell]) => this.normalize(id, spell))
      .sort((a, b) => a.level - b.level || a.name.localeCompare(b.name)),
  );

  async saveSpell(draft: SpellTemplateDraft): Promise<string> {
    const now = Date.now();
    const existing = this.records()?.[draft.id];
    const spell: SpellTemplate = {
      ...draft,
      level: Math.max(0, Math.min(9, Math.floor(draft.level))),
      isCantrip: draft.level === 0,
      createdAt: existing?.createdAt ?? now,
      lastUpdated: now,
    };
    await this.realtimeData.set(spellTemplatePath(draft.id), spell);
    return draft.id;
  }

  async deleteSpell(id: string): Promise<void> {
    await this.realtimeData.remove(spellTemplatePath(id));
  }

  private normalize(id: string, spell: Partial<SpellTemplate>): SpellTemplate {
    const level = Math.max(0, Math.min(9, Math.floor(spell.level ?? 0)));
    return {
      id: spell.id ?? id,
      name: spell.name ?? 'Заклинание без названия',
      level,
      school: spell.school ?? '',
      description: spell.description ?? '',
      higherLevel: spell.higherLevel ?? '',
      damageFormula: spell.damageFormula ?? '',
      damageType: spell.damageType ?? '',
      castingTime: spell.castingTime ?? '',
      range: spell.range ?? '',
      duration: spell.duration ?? '',
      components: spell.components ?? '',
      isCantrip: spell.isCantrip ?? level === 0,
      isRitual: spell.isRitual ?? false,
      requiresConcentration: spell.requiresConcentration ?? false,
      source: spell.source ?? {
        provider: 'open5e',
        key: '',
        documentKey: '',
        documentName: 'Неизвестный источник',
        permalink: '',
        originalName: spell.name ?? '',
        originalDescription: spell.description ?? '',
        importedAt: spell.createdAt ?? 0,
      },
      createdAt: spell.createdAt ?? spell.lastUpdated ?? 0,
      lastUpdated: spell.lastUpdated ?? 0,
    };
  }
}
