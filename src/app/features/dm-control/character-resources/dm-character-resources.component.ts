import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import {
  CharacterResource,
  ResourceEffectDuration,
  ResourceRecovery,
  ResourceSpendMode,
} from '../../../core/models/character-resource.model';
import { ParsedCharacter } from '../../../core/models/character.model';
import { BattleService } from '../../../core/services/battle.service';
import { CharacterService } from '../../../core/services/character.service';
import { LoggerService } from '../../../core/services/logger.service';
import { CHARACTER_RESOURCE_PRESETS } from './dm-character-resources.constants';

@Component({
  selector: 'app-dm-character-resources',
  standalone: true,
  imports: [TranslocoPipe],
  templateUrl: './dm-character-resources.component.html',
  styleUrl: './dm-character-resources.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DmCharacterResourcesComponent {
  private readonly battle = inject(BattleService);
  private readonly characters = inject(CharacterService);
  private readonly logger = inject(LoggerService);
  private readonly i18n = inject(TranslocoService);

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
  readonly resourceIcon = signal('⚡');
  readonly resourceDescription = signal('');
  readonly resourceUnlimited = signal(false);
  readonly resourceCurrent = signal(0);
  readonly resourceMax = signal(0);
  readonly resourceRecovery = signal<ResourceRecovery>('long-rest');
  readonly resourceSpendMode = signal<ResourceSpendMode>('fixed');
  readonly resourceSpendAmount = signal(1);
  readonly resourceShortRestRestore = signal(0);
  readonly resourceLinkedSpellId = signal('');
  readonly resourceActivatesEffect = signal(false);
  readonly resourceEffectDuration = signal<ResourceEffectDuration>('manual');
  readonly resourceEffectRounds = signal(1);

  readonly resourcePresets = CHARACTER_RESOURCE_PRESETS;

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
      .then(() => this.message.set(this.i18n.translate('resourceManager.feedback.slotsSaved')))
      .catch((error: unknown) => this.handleError('saveSlot', error))
      .finally(() => this.saving.set(false));
  }

  editResource(resource: CharacterResource): void {
    this.resourceId.set(resource.id);
    this.resourceName.set(resource.name);
    this.resourceIcon.set(resource.icon ?? resource.activeEffect?.icon ?? '⚡');
    this.resourceDescription.set(resource.description ?? '');
    this.resourceUnlimited.set(resource.isUnlimited === true);
    this.resourceCurrent.set(resource.current);
    this.resourceMax.set(resource.max);
    this.resourceRecovery.set(resource.recovery);
    this.resourceSpendMode.set(resource.spendMode ?? 'fixed');
    this.resourceSpendAmount.set(resource.spendAmount ?? 1);
    this.resourceShortRestRestore.set(resource.shortRestRestore ?? 0);
    this.resourceLinkedSpellId.set(resource.linkedSpellId ?? '');
    this.resourceActivatesEffect.set(resource.activeEffect !== undefined);
    this.resourceEffectDuration.set(resource.activeEffect?.duration ?? 'manual');
    this.resourceEffectRounds.set(resource.activeEffect?.rounds ?? 1);
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
        icon: this.resourceIcon().trim() || '⚡',
        description: this.resourceDescription().trim(),
        isUnlimited: this.resourceUnlimited(),
        current: this.resourceCurrent(),
        max: this.resourceMax(),
        recovery: this.resourceRecovery(),
        ...(!this.resourceUnlimited() && this.resourceSpendMode() === 'variable'
          ? { spendMode: 'variable' as const }
          : {}),
        ...(!this.resourceUnlimited() && this.resourceSpendAmount() !== 1
          ? { spendAmount: this.resourceSpendAmount() }
          : {}),
        ...(!this.resourceUnlimited() && this.resourceShortRestRestore() > 0
          ? { shortRestRestore: this.resourceShortRestRestore() }
          : {}),
        ...(this.resourceLinkedSpellId()
          ? { linkedSpellId: this.resourceLinkedSpellId() }
          : {}),
        ...(this.resourceActivatesEffect()
          ? {
              activeEffect: {
                duration: this.resourceEffectDuration(),
                ...(this.resourceIcon().trim()
                  ? { icon: this.resourceIcon().trim() }
                  : {}),
                ...(this.resourceEffectDuration() === 'rounds'
                  ? { rounds: this.resourceEffectRounds() }
                  : {}),
              },
            }
          : {}),
      })
      .then(() => this.reloadCharacter())
      .then(() => {
        this.message.set(this.i18n.translate('resourceManager.feedback.resourceSaved'));
        this.resetResourceEditor();
      })
      .catch((error: unknown) => this.handleError('saveResource', error))
      .finally(() => this.saving.set(false));
  }

  deleteResource(resource: CharacterResource): void {
    const playerName = this.selectedPlayerName();
    if (!playerName || this.saving()) return;
    if (!window.confirm(
      this.i18n.translate('resourceManager.confirmDelete', { name: resource.name }),
    )) return;

    this.saving.set(true);
    this.clearMessages();
    this.characters
      .removeResource(playerName, resource.id)
      .then(() => this.reloadCharacter())
      .then(() => {
        if (this.resourceId() === resource.id) this.resetResourceEditor();
        this.message.set(this.i18n.translate('resourceManager.feedback.resourceDeleted'));
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
    this.resourceIcon.set('⚡');
    this.resourceDescription.set('');
    this.resourceUnlimited.set(false);
    this.resourceCurrent.set(0);
    this.resourceMax.set(0);
    this.resourceRecovery.set('long-rest');
    this.resourceSpendMode.set('fixed');
    this.resourceSpendAmount.set(1);
    this.resourceShortRestRestore.set(0);
    this.resourceLinkedSpellId.set('');
    this.resourceActivatesEffect.set(false);
    this.resourceEffectDuration.set('manual');
    this.resourceEffectRounds.set(1);
  }

  setNumber(
    target:
      | 'slotLevel'
      | 'slotCurrent'
      | 'slotMax'
      | 'resourceCurrent'
      | 'resourceMax'
      | 'resourceSpendAmount'
      | 'resourceShortRestRestore'
      | 'resourceEffectRounds',
    event: Event,
  ): void {
    const value = Math.max(0, Math.floor(Number((event.target as HTMLInputElement).value) || 0));
    const minimumOne = target === 'slotLevel' || target === 'resourceSpendAmount' || target === 'resourceEffectRounds';
    this[target].set(
      target === 'slotLevel'
        ? Math.min(9, Math.max(1, value))
        : minimumOne
          ? Math.max(1, value)
          : value,
    );
  }

  setResourceName(event: Event): void {
    this.resourceName.set((event.target as HTMLInputElement).value);
  }

  setResourceIcon(event: Event): void {
    this.resourceIcon.set((event.target as HTMLInputElement).value);
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

  setSpendMode(event: Event): void {
    this.resourceSpendMode.set(
      (event.target as HTMLSelectElement).value === 'variable' ? 'variable' : 'fixed',
    );
  }

  setLinkedSpell(event: Event): void {
    this.resourceLinkedSpellId.set((event.target as HTMLSelectElement).value);
  }

  setActivatesEffect(event: Event): void {
    this.resourceActivatesEffect.set((event.target as HTMLInputElement).checked);
  }

  setEffectDuration(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.resourceEffectDuration.set(
      value === 'until-next-turn-end' || value === 'rounds' ? value : 'manual',
    );
  }

  applyResourcePreset(presetId: string): void {
    const level = this.character()?.level ?? 1;
    this.resetResourceEditor();
    switch (presetId) {
      case 'rage':
        this.resourceName.set(this.presetText('rage', 'name'));
        this.resourceIcon.set('🔥');
        this.resourceDescription.set(this.presetText('rage', 'description'));
        this.resourceCurrent.set(
          level >= 17 ? 6 : level >= 12 ? 5 : level >= 6 ? 4 : level >= 3 ? 3 : 2,
        );
        this.resourceMax.set(this.resourceCurrent());
        this.resourceRecovery.set('long-rest');
        this.resourceShortRestRestore.set(1);
        this.resourceActivatesEffect.set(true);
        this.resourceEffectDuration.set('until-next-turn-end');
        break;
      case 'lay-on-hands':
        this.resourceName.set(this.presetText('lay-on-hands', 'name'));
        this.resourceIcon.set('✋');
        this.resourceDescription.set(this.presetText('lay-on-hands', 'description'));
        this.resourceCurrent.set(level * 5);
        this.resourceMax.set(level * 5);
        this.resourceSpendMode.set('variable');
        this.resourceRecovery.set('long-rest');
        break;
      case 'channel-divinity':
        this.resourceName.set(this.presetText('channel-divinity', 'name'));
        this.resourceIcon.set('✨');
        this.resourceDescription.set(this.presetText('channel-divinity', 'description'));
        this.resourceCurrent.set(level >= 11 ? 3 : 2);
        this.resourceMax.set(this.resourceCurrent());
        this.resourceRecovery.set('long-rest');
        this.resourceShortRestRestore.set(1);
        break;
      case 'focus-points':
        this.resourceName.set(this.presetText('focus-points', 'name'));
        this.resourceIcon.set('☯️');
        this.resourceDescription.set(this.presetText('focus-points', 'description'));
        this.resourceCurrent.set(level);
        this.resourceMax.set(level);
        this.resourceSpendMode.set('variable');
        this.resourceRecovery.set('short-rest');
        break;
      case 'heroic-inspiration':
        this.resourceName.set(this.presetText('heroic-inspiration', 'name'));
        this.resourceIcon.set('⭐');
        this.resourceDescription.set(this.presetText('heroic-inspiration', 'description'));
        this.resourceCurrent.set(1);
        this.resourceMax.set(1);
        this.resourceRecovery.set('long-rest');
        break;
      case 'free-spell':
        this.resourceName.set(this.presetText('free-spell', 'name'));
        this.resourceIcon.set('🔮');
        this.resourceDescription.set(this.presetText('free-spell', 'description'));
        this.resourceCurrent.set(1);
        this.resourceMax.set(1);
        this.resourceRecovery.set('long-rest');
        break;
    }
    this.clearMessages();
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
    this.error.set(this.i18n.translate('resourceManager.error.save'));
  }

  private presetText(
    presetId: (typeof CHARACTER_RESOURCE_PRESETS)[number]['id'],
    field: 'name' | 'description',
  ): string {
    return this.i18n.translate(`resourceManager.presetData.${presetId}.${field}`);
  }

  private clearMessages(): void {
    this.message.set(null);
    this.error.set(null);
  }
}
