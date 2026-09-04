import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { COMBATANT_STATUS } from '../../../core/constants/combatant.constants';
import { BattleService } from '../../../core/services/battle.service';
import { LoggerService } from '../../../core/services/logger.service';
import { DmHpOperation, DmHpTargetType } from './dm-hp-control.model';

@Component({
  selector: 'app-dm-hp-control',
  standalone: true,
  imports: [TranslocoPipe],
  templateUrl: './dm-hp-control.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DmHpControlComponent {
  private readonly battleService = inject(BattleService);
  private readonly logger = inject(LoggerService);

  readonly hpOperation = signal<DmHpOperation>('damage');
  readonly targetType = signal<DmHpTargetType>('enemies');
  readonly targetId = signal<string | null>(null);
  readonly amount = signal(0);
  readonly selectedCombatantIds = signal<string[]>([]);

  readonly aliveEnemies = this.battleService.aliveEnemies;
  readonly playersInBattle = this.battleService.playersInBattle;
  readonly combatants = this.battleService.combatants;
  readonly sortedCombatants = this.battleService.sortedCombatants;

  readonly availableTargets = computed(() => {
    switch (this.targetType()) {
      case 'players':
        return Object.values(this.playersInBattle()).filter(
          (player) => player.status !== COMBATANT_STATUS.DEAD,
        );
      case 'selected':
        return this.sortedCombatants().filter(
          (combatant) => combatant.status !== COMBATANT_STATUS.DEAD,
        );
      default:
        return this.aliveEnemies();
    }
  });

  readonly selectedTarget = computed(() => {
    const targetId = this.targetId();
    return targetId ? this.combatants()[targetId] ?? null : null;
  });

  readonly maxHealingAmount = computed<number | null>(() => {
    const target = this.selectedTarget();
    return target ? Math.max(0, target.maxHp - target.currentHp) : null;
  });

  readonly canApplyDamage = computed(() => {
    if (this.targetType() === 'all') {
      return this.amount() > 0 && this.aliveEnemies().length > 0;
    }
    if (this.targetType() === 'selected') {
      return this.amount() > 0 && this.selectedCombatantIds().length > 0;
    }
    return this.amount() > 0 && !!this.targetId();
  });

  readonly canApplyHealing = computed(() => {
    if (this.targetType() === 'selected') {
      return this.amount() > 0 && this.selectedCombatantIds().length > 0;
    }
    return this.targetType() !== 'all' && this.amount() > 0 && !!this.targetId();
  });

  readonly canApplyTemporaryHp = computed(
    () => this.amount() >= 0 && !!this.targetId() && this.targetType() !== 'all',
  );

  setOperation(operation: DmHpOperation): void {
    this.hpOperation.set(operation);
    if (operation !== 'damage' && this.targetType() === 'all') {
      this.targetType.set('enemies');
    }
    if (operation === 'temporary' && this.targetType() === 'selected') {
      this.targetType.set('players');
    }
    this.resetForm();
  }

  setTargetType(type: DmHpTargetType): void {
    this.targetType.set(type);
    this.targetId.set(null);
    if (type !== 'selected') this.selectedCombatantIds.set([]);
  }

  onTargetChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.targetId.set(select.value || null);
    this.clampHealingAmount();
  }

  onTargetToggle(combatantId: string, event: Event): void {
    const input = event.target as HTMLInputElement;
    this.selectedCombatantIds.update((ids) =>
      input.checked
        ? ids.includes(combatantId)
          ? ids
          : [...ids, combatantId]
        : ids.filter((id) => id !== combatantId),
    );
  }

  onAmountInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const value = Number(input.value);
    const safeValue = value > 0 ? value : 0;
    const maximum = this.hpOperation() === 'heal' ? this.maxHealingAmount() : null;
    this.amount.set(maximum === null ? safeValue : Math.min(safeValue, maximum));
  }

  applyDamage(): void {
    if (!this.canApplyDamage()) return;
    const amount = this.amount();
    const operation = this.targetType() === 'all'
      ? this.battleService.damageAll(amount)
      : this.targetType() === 'selected'
        ? this.battleService.damageMany(this.selectedCombatantIds(), amount)
        : this.battleService.takeDamage(this.targetId() as string, amount);
    this.finishOperation(operation, 'applyDamage');
  }

  applyHealing(): void {
    if (!this.canApplyHealing()) return;
    const operation = this.targetType() === 'selected'
      ? this.battleService.healMany(this.selectedCombatantIds(), this.amount())
      : this.battleService.heal(this.targetId() as string, this.amount());
    this.finishOperation(operation, 'applyHealing');
  }

  applyTemporaryHp(): void {
    if (!this.canApplyTemporaryHp()) return;
    this.finishOperation(
      this.battleService.setTemporaryHp(this.targetId() as string, this.amount()),
      'applyTemporaryHp',
    );
  }

  resetForm(): void {
    this.amount.set(0);
    this.targetId.set(null);
    this.selectedCombatantIds.set([]);
  }

  private finishOperation(operation: Promise<unknown>, method: string): void {
    operation
      .then(() => this.resetForm())
      .catch((error: unknown) => this.logger.error(`DmHpControlComponent.${method}`, error));
  }

  private clampHealingAmount(): void {
    if (this.hpOperation() !== 'heal' || this.targetType() === 'selected') return;
    const maximum = this.maxHealingAmount();
    if (maximum !== null && this.amount() > maximum) this.amount.set(maximum);
  }
}
