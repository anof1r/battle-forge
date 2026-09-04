import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { getStatusEffectDefinition } from '../../../core/constants/status-effect.constants';
import { ActiveStatusEffect } from '../../../core/models/combatant.model';

@Component({
  selector: 'bf-status-effect-list',
  standalone: true,
  imports: [TranslocoPipe],
  templateUrl: './status-effect-list.component.html',
  styleUrl: './status-effect-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatusEffectListComponent {
  private readonly i18n = inject(TranslocoService);

  readonly effects = input<readonly ActiveStatusEffect[]>([]);
  readonly label = input<string | null>(null);

  protected readonly definition = getStatusEffectDefinition;

  protected effectLabel(effect: ActiveStatusEffect): string {
    return (
      effect.customLabel ?? this.i18n.translate(`statusEffects.effects.${effect.type}.label`)
    );
  }

  protected effectIcon(effect: ActiveStatusEffect): string {
    return effect.customIcon ?? this.definition(effect.type).icon;
  }

  protected tooltip(effect: ActiveStatusEffect): string {
    const details = [
      effect.customLabel
        ? `${effect.customLabel}.`
        : this.i18n.translate(`statusEffects.effects.${effect.type}.description`),
      effect.source
        ? this.i18n.translate('statusEffects.tooltip.source', { source: effect.source })
        : '',
      effect.concentrationSourceId
        ? this.i18n.translate('statusEffects.tooltip.concentration')
        : '',
      effect.saveAbility
        ? this.i18n.translate('statusEffects.tooltip.save', {
            ability: effect.saveAbility,
            dc: effect.saveDc ?? '—',
          })
        : '',
      effect.notes ?? '',
    ];
    return details.filter(Boolean).join('\n');
  }
}
