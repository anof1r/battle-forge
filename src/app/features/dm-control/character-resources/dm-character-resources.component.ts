import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import {
  CharacterResource,
  ParsedCharacter,
  ResourceRecovery,
} from '../../../core/models/character.model';
import { BattleService } from '../../../core/services/battle.service';
import { CharacterService } from '../../../core/services/character.service';
import { LoggerService } from '../../../core/services/logger.service';

@Component({
  selector: 'app-dm-character-resources',
  standalone: true,
  templateUrl: './dm-character-resources.component.html',
  styleUrl: './dm-character-resources.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DmCharacterResourcesComponent {
  private readonly battle = inject(BattleService);
  private readonly characters = inject(CharacterService);
  private readonly logger = inject(LoggerService);

  readonly players = computed(() =>
    Object.values(this.battle.playersInBattle()).sort((a, b) => a.name.localeCompare(b.name)),
  );
  readonly selectedPlayerId = signal('');
  readonly character = signal<ParsedCharacter | null>(null);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly message = signal<string | null>(null);
  readonly error = signal<string | null>(null);

  readonly slotLevel = signal(1);
  readonly slotCurrent = signal(0);
  readonly slotMax = signal(0);
  readonly slotRecovery = signal<'short-rest' | 'long-rest'>('long-rest');

  readonly resourceId = signal<string | null>(null);
  readonly resourceName = signal('');
  readonly resourceDescription = signal('');
  readonly resourceUnlimited = signal(false);
  readonly resourceCurrent = signal(0);
  readonly resourceMax = signal(0);
  readonly resourceRecovery = signal<ResourceRecovery>('long-rest');

  selectPlayer(event: Event): void {
    const playerId = (event.target as HTMLSelectElement).value;
    this.selectedPlayerId.set(playerId);
    this.character.set(null);
    this.clearMessages();
    void this.reloadCharacter();
  }

  editSlot(level: number): void {
    const slot = this.character()?.spellSlots?.find((candidate) => candidate.level === level);
    this.slotLevel.set(level);
    this.slotMax.set(slot?.max ?? 0);
    this.slotCurrent.set(slot?.current ?? slot?.max ?? 0);
    this.slotRecovery.set(slot?.recovery ?? 'long-rest');
  }

  slotAt(level: number): { current: number; max: number } {
    return this.character()?.spellSlots?.find((candidate) => candidate.level === level) ?? {
      current: 0,
      max: 0,
    };
  }

  saveSlot(): void {
    const playerName = this.selectedPlayerName();
    if (!playerName || this.saving()) return;
    this.saving.set(true);
    this.clearMessages();
    this.characters
      .setSpellSlotPool(playerName, {
        level: this.slotLevel(),
        current: this.slotCurrent(),
        max: this.slotMax(),
        recovery: this.slotRecovery(),
      })
      .then(() => this.reloadCharacter())
      .then(() => this.message.set('Ячейки заклинаний сохранены.'))
      .catch((error: unknown) => this.handleError('saveSlot', error))
      .finally(() => this.saving.set(false));
  }

  editResource(resource: CharacterResource): void {
    this.resourceId.set(resource.id);
    this.resourceName.set(resource.name);
    this.resourceDescription.set(resource.description ?? '');
    this.resourceUnlimited.set(resource.isUnlimited === true);
    this.resourceCurrent.set(resource.current);
    this.resourceMax.set(resource.max);
    this.resourceRecovery.set(resource.recovery);
    this.clearMessages();
  }

  saveResource(): void {
    const playerName = this.selectedPlayerName();
    const name = this.resourceName().trim();
    if (!playerName || !name || this.saving()) return;
    this.saving.set(true);
    this.clearMessages();
    this.characters
      .upsertResource(playerName, {
        id: this.resourceId() ?? '',
        name,
        description: this.resourceDescription().trim(),
        isUnlimited: this.resourceUnlimited(),
        current: this.resourceCurrent(),
        max: this.resourceMax(),
        recovery: this.resourceRecovery(),
      })
      .then(() => this.reloadCharacter())
      .then(() => {
        this.message.set('Ресурс сохранён.');
        this.resetResourceEditor();
      })
      .catch((error: unknown) => this.handleError('saveResource', error))
      .finally(() => this.saving.set(false));
  }

  deleteResource(resource: CharacterResource): void {
    const playerName = this.selectedPlayerName();
    if (!playerName || this.saving()) return;
    if (!window.confirm(`Удалить ресурс «${resource.name}» у героя?`)) return;

    this.saving.set(true);
    this.clearMessages();
    this.characters
      .removeResource(playerName, resource.id)
      .then(() => this.reloadCharacter())
      .then(() => {
        if (this.resourceId() === resource.id) this.resetResourceEditor();
        this.message.set('Ресурс удалён.');
      })
      .catch((error: unknown) => this.handleError('deleteResource', error))
      .finally(() => this.saving.set(false));
  }

  fillResourceToMax(): void {
    this.resourceCurrent.set(this.resourceMax());
  }

  resetResourceEditor(): void {
    this.resourceId.set(null);
    this.resourceName.set('');
    this.resourceDescription.set('');
    this.resourceUnlimited.set(false);
    this.resourceCurrent.set(0);
    this.resourceMax.set(0);
    this.resourceRecovery.set('long-rest');
  }

  setNumber(target: 'slotLevel' | 'slotCurrent' | 'slotMax' | 'resourceCurrent' | 'resourceMax', event: Event): void {
    const value = Math.max(0, Math.floor(Number((event.target as HTMLInputElement).value) || 0));
    this[target].set(target === 'slotLevel' ? Math.min(9, Math.max(1, value)) : value);
  }

  setResourceName(event: Event): void {
    this.resourceName.set((event.target as HTMLInputElement).value);
  }

  setResourceDescription(event: Event): void {
    this.resourceDescription.set((event.target as HTMLTextAreaElement).value);
  }

  setResourceUnlimited(event: Event): void {
    const isUnlimited = (event.target as HTMLInputElement).checked;
    this.resourceUnlimited.set(isUnlimited);
    if (isUnlimited) {
      this.resourceCurrent.set(0);
      this.resourceMax.set(0);
      this.resourceRecovery.set('manual');
    }
  }

  setRecovery(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.resourceRecovery.set(
      value === 'short-rest' || value === 'long-rest' ? value : 'manual',
    );
  }

  setSlotRecovery(event: Event): void {
    this.slotRecovery.set(
      (event.target as HTMLSelectElement).value === 'short-rest'
        ? 'short-rest'
        : 'long-rest',
    );
  }

  private selectedPlayerName(): string | null {
    return this.players().find((player) => player.id === this.selectedPlayerId())?.playerName ?? null;
  }

  private async reloadCharacter(): Promise<void> {
    const playerName = this.selectedPlayerName();
    if (!playerName) return;
    this.loading.set(true);
    try {
      this.character.set(await this.characters.loadCharacter(playerName));
    } catch (error) {
      this.handleError('reloadCharacter', error);
    } finally {
      this.loading.set(false);
    }
  }

  private handleError(method: string, error: unknown): void {
    this.logger.error(`DmCharacterResourcesComponent.${method}`, error);
    this.error.set('Не удалось сохранить ресурсы. Данные формы сохранены.');
  }

  private clearMessages(): void {
    this.message.set(null);
    this.error.set(null);
  }
}
