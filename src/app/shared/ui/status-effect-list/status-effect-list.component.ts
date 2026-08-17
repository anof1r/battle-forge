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
}
