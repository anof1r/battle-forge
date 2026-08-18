import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { getStatusEffectDefinition } from '../../../core/constants/status-effect.constants';
import { ActiveStatusEffect } from '../../../core/models/combatant.model';

@Component({
  selector: 'bf-status-effect-list',
  standalone: true,
  templateUrl: './status-effect-list.component.html',
  styleUrl: './status-effect-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatusEffectListComponent {
  readonly effects = input<readonly ActiveStatusEffect[]>([]);
  readonly label = input<string | null>(null);

  protected readonly definition = getStatusEffectDefinition;

  protected tooltip(effect: ActiveStatusEffect): string {
    const details = [
      this.definition(effect.type).description,
      effect.source ? `Источник: ${effect.source}` : '',
      effect.concentrationSourceId ? 'Требует концентрации' : '',
      effect.saveAbility ? `Спасбросок: ${effect.saveAbility}, СЛ ${effect.saveDc ?? '—'}` : '',
      effect.notes ?? '',
    ];
    return details.filter(Boolean).join('\n');
  }
}
