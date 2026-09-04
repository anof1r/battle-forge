import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { COMBATANT_STATUS, CombatantStatus } from '../../../core/constants/combatant.constants';
import { DeathSaves } from '../../../core/models/combatant.model';

@Component({
  selector: 'bf-combatant-life-state',
  standalone: true,
  imports: [TranslocoPipe],
  templateUrl: './combatant-life-state.component.html',
  styleUrl: './combatant-life-state.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CombatantLifeStateComponent {
  readonly status = input.required<CombatantStatus>();
  readonly deathSaves = input<DeathSaves | undefined>();

  protected readonly state = computed(() => {
    switch (this.status()) {
      case COMBATANT_STATUS.DOWNED:
        return { icon: '🩸', labelKey: 'lifeState.downed' };
      case COMBATANT_STATUS.STABLE:
        return { icon: '🕯️', labelKey: 'lifeState.stable' };
      case COMBATANT_STATUS.DEAD:
        return { icon: '💀', labelKey: 'lifeState.dead' };
      default:
        return { icon: '❤️', labelKey: 'lifeState.alive' };
    }
  });
}
