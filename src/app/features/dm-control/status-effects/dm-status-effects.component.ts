import {
  ChangeDetectionStrategy,
  Component,
  WritableSignal,
  computed,
  inject,
  signal,
} from '@angular/core';
import { UpperCasePipe } from '@angular/common';
import { COMBATANT_STATUS } from '../../../core/constants/combatant.constants';
import {
  getStatusEffectDefinition,
  STATUS_EFFECT_DEFINITIONS,
  STATUS_EFFECT_TRIGGER,
  STATUS_EFFECT_TYPE,
  StatusEffectTrigger,
  StatusEffectType,
} from '../../../core/constants/status-effect.constants';
import { BattleService } from '../../../core/services/battle.service';
import { LoggerService } from '../../../core/services/logger.service';

@Component({
  selector: 'app-dm-status-effects',
  standalone: true,
  imports: [UpperCasePipe],
  templateUrl: './dm-status-effects.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DmStatusEffectsComponent {
  private readonly battleService = inject(BattleService);
  private readonly logger = inject(LoggerService);

  readonly effectDefinitions = STATUS_EFFECT_DEFINITIONS.filter(
    (effect) => effect.type !== STATUS_EFFECT_TYPE.RESOURCE_ACTIVE,
  );
  readonly combatants = this.battleService.sortedCombatants;

  readonly selectedTargetId = signal<string | null>(null);
  readonly selectedEffect = signal<StatusEffectType>(STATUS_EFFECT_TYPE.POISONED);
  readonly applying = signal(false);
  readonly removingEffectId = signal<string | null>(null);
  readonly error = signal<string | null>(null);
  readonly damage = signal(0);
  readonly duration = signal(0);
  readonly trigger = signal<StatusEffectTrigger>(STATUS_EFFECT_TRIGGER.TURN_START);
  readonly source = signal('');
  readonly concentrationSourceId = signal('');
  readonly saveAbility = signal('');
  readonly saveDc = signal(0);
  readonly notes = signal('');

  readonly selectedTarget = computed(() => {
    const targetId = this.selectedTargetId();
    return targetId ? this.battleService.combatants()[targetId] ?? null : null;
  });

  readonly canApply = computed(() => {
    const target = this.selectedTarget();
    return (
      !!target &&
      target.status !== COMBATANT_STATUS.DEAD &&
      !(target.activeEffects ?? []).some((effect) => effect.type === this.selectedEffect())
    );
  });

  readonly selectedDefinition = computed(() => getStatusEffectDefinition(this.selectedEffect()));
  readonly hasTurnConfig = computed(() => this.damage() > 0 || this.duration() > 0);
  readonly combatantsWithEffects = computed(() =>
    this.combatants().filter((combatant) => (combatant.activeEffects?.length ?? 0) > 0),
  );

  onTargetChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.selectedTargetId.set(select.value || null);
    this.error.set(null);
  }

  selectEffect(type: StatusEffectType): void {
    this.selectedEffect.set(type);
    if (!getStatusEffectDefinition(type).damageCapable) this.damage.set(0);
    this.error.set(null);
  }

  onDamageInput(event: Event): void {
    this.damage.set(this.nonNegativeInteger(event));
  }

  onDurationInput(event: Event): void {
    this.duration.set(this.nonNegativeInteger(event));
  }

  onTriggerChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.trigger.set(
      select.value === STATUS_EFFECT_TRIGGER.TURN_END
        ? STATUS_EFFECT_TRIGGER.TURN_END
        : STATUS_EFFECT_TRIGGER.TURN_START,
    );
  }

  setText(target: WritableSignal<string>, event: Event): void {
    const input = event.target as HTMLInputElement | HTMLSelectElement;
    target.set(input.value);
  }

  onSaveDcInput(event: Event): void {
    this.saveDc.set(this.nonNegativeInteger(event));
  }

  effectDefinition(type: StatusEffectType) {
    return getStatusEffectDefinition(type);
  }

  applyEffect(): void {
    const targetId = this.selectedTargetId();
    if (!targetId || !this.canApply() || this.applying()) return;

    this.applying.set(true);
    this.error.set(null);
    this.battleService
      .addStatusEffect(targetId, this.selectedEffect(), {
        damagePerTrigger: this.damage(),
        durationTriggers: this.duration(),
        trigger: this.trigger(),
        source: this.source(),
        concentrationSourceId: this.concentrationSourceId() || undefined,
        saveAbility: this.saveAbility(),
        saveDc: this.saveDc(),
        notes: this.notes(),
      })
      .then((added) => {
        if (!added) {
          this.error.set('Эффект уже назначен или участник больше недоступен.');
          return;
        }
        this.resetOptionalFields();
      })
      .catch((error: unknown) => {
        this.logger.error('DmStatusEffectsComponent.applyEffect', error);
        this.error.set('Не удалось назначить эффект.');
      })
      .finally(() => this.applying.set(false));
  }

  removeEffect(combatantId: string, effectId: string): void {
    if (this.removingEffectId()) return;
    this.removingEffectId.set(effectId);
    this.error.set(null);
    this.battleService
      .removeStatusEffect(combatantId, effectId)
      .then((removed) => {
        if (!removed) this.error.set('Эффект уже снят или участник больше недоступен.');
      })
      .catch((error: unknown) => {
        this.logger.error('DmStatusEffectsComponent.removeEffect', error);
        this.error.set('Не удалось снять эффект.');
      })
      .finally(() => this.removingEffectId.set(null));
  }

  private nonNegativeInteger(event: Event): number {
    const input = event.target as HTMLInputElement;
    const value = Number(input.value);
    return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
  }

  private resetOptionalFields(): void {
    this.damage.set(0);
    this.duration.set(0);
    this.source.set('');
    this.concentrationSourceId.set('');
    this.saveAbility.set('');
    this.saveDc.set(0);
    this.notes.set('');
  }
}
