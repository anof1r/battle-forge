import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { UpperCasePipe } from '@angular/common';
import { BattleService } from '../../core/services/battle.service';
import { HpBarComponent } from '../../shared/ui/hp-bar/hp-bar.component';
import { EnemyIconComponent } from '../../shared/ui/enemy-icon/enemy-icon.component';
import { BATTLE_STATUS } from '../../core/constants/battle-status.constants';
import { DEFAULT_ENEMY_TYPE } from '../../core/constants/enemy-generator.constants';

@Component({
  selector: 'app-display',
  standalone: true,
  imports: [UpperCasePipe, HpBarComponent, EnemyIconComponent],
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
  readonly currentRound = this.battleService.currentRound;
  readonly currentEnemy = this.battleService.currentCombatant;
}
