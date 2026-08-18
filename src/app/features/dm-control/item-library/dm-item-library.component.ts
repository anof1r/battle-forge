import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ITEM_RARITY, ItemRarity } from '../../../core/constants/item-rarity.constants';
import { ItemTemplate } from '../../../core/models';
import { BattleService } from '../../../core/services/battle.service';
import { InventoryService } from '../../../core/services/inventory.service';
import { ItemLibraryService } from '../../../core/services/item-library.service';
import { LoggerService } from '../../../core/services/logger.service';

@Component({
  selector: 'app-dm-item-library',
  standalone: true,
  templateUrl: './dm-item-library.component.html',
  styleUrl: './dm-item-library.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DmItemLibraryComponent {
  private readonly library = inject(ItemLibraryService);
  private readonly inventory = inject(InventoryService);
  private readonly battle = inject(BattleService);
  private readonly logger = inject(LoggerService);

  readonly items = this.library.items;
  readonly players = computed(() =>
    Object.values(this.battle.playersInBattle()).sort((a, b) => a.name.localeCompare(b.name)),
  );

  readonly itemId = signal<string | null>(null);
  readonly itemName = signal('');
  readonly itemDescription = signal('');
  readonly itemEffectFormula = signal('');
  readonly itemDefaultQuantity = signal(1);
  readonly itemRarity = signal<ItemRarity>(ITEM_RARITY.COMMON);
  readonly itemIcon = signal('');
  readonly itemStackable = signal(true);
  readonly itemConsumable = signal(true);

  readonly selectedPlayerId = signal('');
  readonly selectedTemplateId = signal('');
  readonly giveQuantity = signal(1);
  readonly saving = signal(false);
  readonly giving = signal(false);
  readonly feedback = signal<string | null>(null);
  readonly error = signal<string | null>(null);

  readonly selectedTemplate = computed(
    () => this.items().find((item) => item.id === this.selectedTemplateId()) ?? null,
  );
  readonly canSave = computed(() => this.itemName().trim().length > 0);
  readonly canGive = computed(
    () => !!this.selectedPlayerId() && !!this.selectedTemplate() && this.giveQuantity() > 0,
  );

  setName(event: Event): void {
    this.itemName.set((event.target as HTMLInputElement).value);
  }

  setDescription(event: Event): void {
    this.itemDescription.set((event.target as HTMLTextAreaElement).value);
  }

  setEffectFormula(event: Event): void {
    this.itemEffectFormula.set((event.target as HTMLInputElement).value);
  }

  setIcon(event: Event): void {
    this.itemIcon.set((event.target as HTMLInputElement).value);
  }

  setRarity(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    const rarity = Object.values(ITEM_RARITY).find((candidate) => candidate === value);
    this.itemRarity.set(rarity ?? ITEM_RARITY.COMMON);
  }

  setDefaultQuantity(event: Event): void {
    this.itemDefaultQuantity.set(this.positiveInteger(event));
  }

  setGiveQuantity(event: Event): void {
    this.giveQuantity.set(this.positiveInteger(event));
  }

  setStackable(event: Event): void {
    this.itemStackable.set((event.target as HTMLInputElement).checked);
  }

  setConsumable(event: Event): void {
    this.itemConsumable.set((event.target as HTMLInputElement).checked);
  }

  selectPlayer(event: Event): void {
    this.selectedPlayerId.set((event.target as HTMLSelectElement).value);
  }

  selectTemplate(event: Event): void {
    const templateId = (event.target as HTMLSelectElement).value;
    this.selectedTemplateId.set(templateId);
    const template = this.items().find((item) => item.id === templateId);
    this.giveQuantity.set(template?.defaultQuantity ?? 1);
  }

  saveItem(): void {
    if (!this.canSave() || this.saving()) return;
    this.saving.set(true);
    this.clearMessages();
    this.library
      .saveItem({
        id: this.itemId() ?? undefined,
        name: this.itemName().trim(),
        description: this.itemDescription().trim(),
        effectFormula: this.itemEffectFormula().trim(),
        defaultQuantity: this.itemDefaultQuantity(),
        rarity: this.itemRarity(),
        isStackable: this.itemStackable(),
        isConsumable: this.itemConsumable(),
        icon: this.itemIcon().trim(),
      })
      .then(() => {
        this.feedback.set(this.itemId() ? 'Шаблон предмета обновлён.' : 'Предмет сохранён в библиотеку.');
        this.resetEditor();
      })
      .catch((error: unknown) => {
        this.logger.error('DmItemLibraryComponent.saveItem', error);
        this.error.set('Не удалось сохранить предмет. Данные формы не потеряны.');
      })
      .finally(() => this.saving.set(false));
  }

  editItem(item: ItemTemplate): void {
    this.itemId.set(item.id);
    this.itemName.set(item.name);
    this.itemDescription.set(item.description);
    this.itemEffectFormula.set(item.effectFormula);
    this.itemDefaultQuantity.set(item.defaultQuantity);
    this.itemRarity.set(item.rarity);
    this.itemIcon.set(item.icon);
    this.itemStackable.set(item.isStackable);
    this.itemConsumable.set(item.isConsumable);
    this.clearMessages();
  }

  deleteItem(item: ItemTemplate): void {
    if (!confirm(`Удалить шаблон «${item.name}»?`)) return;
    this.clearMessages();
    this.library
      .deleteItem(item.id)
      .then(() => {
        if (this.itemId() === item.id) this.resetEditor();
        if (this.selectedTemplateId() === item.id) this.selectedTemplateId.set('');
        this.feedback.set('Шаблон предмета удалён.');
      })
      .catch((error: unknown) => {
        this.logger.error('DmItemLibraryComponent.deleteItem', error);
        this.error.set('Не удалось удалить предмет.');
      });
  }

  giveItem(): void {
    const template = this.selectedTemplate();
    const player = this.players().find((candidate) => candidate.id === this.selectedPlayerId());
    if (!template || !player?.playerName || !this.canGive() || this.giving()) return;

    this.giving.set(true);
    this.clearMessages();
    this.inventory
      .giveItem(player.playerName, {
        name: template.name,
        quantity: this.giveQuantity(),
        description: template.description,
        rarity: template.rarity,
        effectFormula: template.effectFormula,
        isStackable: template.isStackable,
        isConsumable: template.isConsumable,
        icon: template.icon,
      })
      .then(() => this.feedback.set(`${template.name} выдан персонажу ${player.name}.`))
      .catch((error: unknown) => {
        this.logger.error('DmItemLibraryComponent.giveItem', error);
        this.error.set('Не удалось выдать предмет. Выбор сохранён.');
      })
      .finally(() => this.giving.set(false));
  }

  resetEditor(): void {
    this.itemId.set(null);
    this.itemName.set('');
    this.itemDescription.set('');
    this.itemEffectFormula.set('');
    this.itemDefaultQuantity.set(1);
    this.itemRarity.set(ITEM_RARITY.COMMON);
    this.itemIcon.set('');
    this.itemStackable.set(true);
    this.itemConsumable.set(true);
  }

  private positiveInteger(event: Event): number {
    const value = Number((event.target as HTMLInputElement).value);
    return Number.isFinite(value) && value > 0 ? Math.floor(value) : 1;
  }

  private clearMessages(): void {
    this.feedback.set(null);
    this.error.set(null);
  }
}
