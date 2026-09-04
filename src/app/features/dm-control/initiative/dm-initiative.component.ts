import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { BattleService } from '../../../core/services/battle.service';
import { LoggerService } from '../../../core/services/logger.service';

@Component({
  selector: 'app-dm-initiative',
  standalone: true,
  imports: [TranslocoPipe],
  templateUrl: './dm-initiative.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DmInitiativeComponent {
  private readonly battleService = inject(BattleService);
  private readonly logger = inject(LoggerService);

  readonly visible = input(false);
  readonly rolls = input<Record<string, number>>({});
  readonly closed = output<void>();

  readonly allCombatants = computed(() => Object.values(this.battleService.combatants()));
  readonly initiativeValues = signal<Record<string, number>>({});
  readonly saving = signal(false);

  private readonly synchronizeRolls = effect(() => {
    const rolls = this.rolls();
    const combatants = untracked(() => this.allCombatants());
    this.initiativeValues.set(
      Object.fromEntries(
        combatants.map((combatant) => [
          combatant.id,
          rolls[combatant.id] ?? combatant.initiative ?? 0,
        ]),
      ),
    );
  });

  onInitiativeInput(combatantId: string, event: Event): void {
    const input = event.target as HTMLInputElement;
    const value = Number(input.value);
    this.initiativeValues.update((values) => ({
      ...values,
      [combatantId]: Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0,
    }));
  }

  confirmInitiative(): void {
    if (this.saving()) return;
    this.saving.set(true);
    const values = this.initiativeValues();

    Promise.all(
      this.allCombatants().map((combatant) =>
        this.battleService.setInitiative(
          combatant.id,
          values[combatant.id] ?? combatant.initiative ?? 0,
        ),
      ),
    )
      .then(() => this.battleService.rollInitiative())
      .then(() => this.closed.emit())
      .catch((error: unknown) =>
        this.logger.error('DmInitiativeComponent.confirmInitiative', error),
      )
      .finally(() => this.saving.set(false));
  }
}
