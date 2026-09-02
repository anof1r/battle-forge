import {
  ChangeDetectionStrategy,
  Component,
  WritableSignal,
  inject,
  signal,
} from '@angular/core';
import { KeyValuePipe } from '@angular/common';
import { ITEM_RARITY, ItemRarity } from '../../../core/constants/item-rarity.constants';
import { BattleService } from '../../../core/services/battle.service';
import { InventoryService } from '../../../core/services/inventory.service';
import { LoggerService } from '../../../core/services/logger.service';

@Component({
  selector: 'app-dm-item-grant',
  standalone: true,
  imports: [KeyValuePipe],
  templateUrl: './dm-item-grant.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DmItemGrantComponent {
  private readonly battleService = inject(BattleService);
  private readonly inventoryService = inject(InventoryService);
  private readonly logger = inject(LoggerService);

  readonly players = this.battleService.playersInBattle;
  readonly selectedPlayerId = signal<string | null>(null);
  readonly itemName = signal('');
  readonly description = signal('');
  readonly quantity = signal(1);
  readonly rarity = signal<ItemRarity>(ITEM_RARITY.COMMON);
  readonly saving = signal(false);

  onPlayerChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.selectedPlayerId.set(select.value || null);
  }

  setText(target: WritableSignal<string>, event: Event): void {
    const input = event.target as HTMLInputElement;
    target.set(input.value);
  }

  onQuantityInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const value = Number(input.value);
    this.quantity.set(Number.isFinite(value) && value > 0 ? Math.floor(value) : 1);
  }

  onRarityChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    const value = select.value as ItemRarity;
    if ((Object.values(ITEM_RARITY) as ItemRarity[]).includes(value)) this.rarity.set(value);
  }

  giveItem(): void {
    const playerId = this.selectedPlayerId();
    const name = this.itemName().trim();
    const quantity = this.quantity();
    if (!playerId || !name || quantity < 1 || this.saving()) return;

    this.saving.set(true);
    this.inventoryService
      .giveItem(playerId.replace('player_', ''), {
        name,
        quantity,
        description: this.description().trim(),
        rarity: this.rarity(),
      })
      .then(() => this.resetForm())
      .catch((error: unknown) => this.logger.error('DmItemGrantComponent.giveItem', error))
      .finally(() => this.saving.set(false));
  }

  private resetForm(): void {
    this.selectedPlayerId.set(null);
    this.itemName.set('');
    this.description.set('');
    this.quantity.set(1);
    this.rarity.set(ITEM_RARITY.COMMON);
  }
}
