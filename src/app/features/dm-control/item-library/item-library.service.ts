import { Injectable, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { DATA_ROOT, itemTemplatePath } from '../../../core/constants/data-paths.constants';
import { ITEM_RARITY } from '../../../core/constants/item-rarity.constants';
import { ItemTemplate, ItemTemplateDraft } from '../../../core/models';
import { RealtimeDataService } from '../../../core/services/realtime-data.service';

@Injectable({ providedIn: 'root' })
export class ItemLibraryService {
  private readonly realtimeData = inject(RealtimeDataService);
  private readonly records = toSignal(
    this.realtimeData.subscribe<Record<string, Partial<ItemTemplate>>>(DATA_ROOT.ITEM_TEMPLATES),
    { initialValue: null },
  );

  readonly items = computed(() =>
    Object.entries(this.records() ?? {})
      .map(([id, item]) => this.normalize(id, item))
      .sort((a, b) => a.name.localeCompare(b.name)),
  );

  async saveItem(draft: ItemTemplateDraft): Promise<string> {
    const now = Date.now();
    const id = draft.id || `item_${crypto.randomUUID()}`;
    const existing = this.records()?.[id];
    const item: ItemTemplate = {
      ...draft,
      defaultQuantity: Math.max(1, Math.floor(draft.defaultQuantity)),
      id,
      createdAt: existing?.createdAt ?? now,
      lastUpdated: now,
    };
    await this.realtimeData.set(itemTemplatePath(id), item);
    return id;
  }

  async deleteItem(templateId: string): Promise<void> {
    await this.realtimeData.remove(itemTemplatePath(templateId));
  }

  private normalize(id: string, item: Partial<ItemTemplate>): ItemTemplate {
    return {
      id: item.id ?? id,
      name: item.name ?? 'Предмет без названия',
      description: item.description ?? '',
      effectFormula: item.effectFormula ?? '',
      defaultQuantity: Math.max(1, Math.floor(item.defaultQuantity ?? 1)),
      rarity: item.rarity ?? ITEM_RARITY.COMMON,
      isStackable: item.isStackable ?? true,
      isConsumable: item.isConsumable ?? true,
      icon: item.icon ?? '',
      createdAt: item.createdAt ?? item.lastUpdated ?? 0,
      lastUpdated: item.lastUpdated ?? 0,
    };
  }
}
