import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { UpperCasePipe } from '@angular/common';
import { BattleService } from '../../core/services/battle.service';
import { HpBarComponent } from '../../shared/ui/hp-bar/hp-bar.component';
import { EnemyIconComponent } from '../../shared/ui/enemy-icon/enemy-icon.component';
import { StatusEffectListComponent } from '../../shared/ui/status-effect-list/status-effect-list.component';
import { BATTLE_STATUS } from '../../core/constants/battle-status.constants';
import { DEFAULT_ENEMY_TYPE } from '../../core/constants/enemy-generator.constants';
import { StatusEffectType } from '../../core/constants/status-effect.constants';
import { Combatant } from '../../core/models/combatant.model';
import { COMBATANT_TYPE } from '../../core/constants/combatant.constants';

@Component({
  selector: 'app-display',
  standalone: true,
  imports: [UpperCasePipe, HpBarComponent, EnemyIconComponent, StatusEffectListComponent],
  templateUrl: './display.component.html',
  styleUrl: './display.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DisplayComponent {
  private readonly battleService = inject(BattleService);

  readonly BATTLE_STATUS = BATTLE_STATUS;
  readonly DEFAULT_ENEMY_TYPE = DEFAULT_ENEMY_TYPE;

  readonly battleStatus = this.battleService.battleStatus;
  readonly aliveEnemies = this.battleService.aliveEnemies;
  readonly combatantsInTurnOrder = this.battleService.sortedCombatants;
  readonly currentRound = this.battleService.currentRound;
  readonly currentEnemy = this.battleService.currentCombatant;

  readonly affectedPlayers = computed(() =>
    this.combatantsInTurnOrder().filter(
      (combatant) =>
        combatant.type === COMBATANT_TYPE.PLAYER &&
        (combatant.activeEffects?.length ?? 0) > 0,
    ),
  );

  hasEffect(combatant: Combatant, type: StatusEffectType): boolean {
    return (combatant.activeEffects ?? []).some((effect) => effect.type === type);
  }
}
