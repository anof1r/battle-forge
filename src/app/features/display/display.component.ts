import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { UpperCasePipe } from '@angular/common';
import { BattleService } from '../../core/services/battle.service';
import { Enemy } from '../../core/models';
import { HpBarComponent } from '../../shared/ui/hp-bar/hp-bar.component';
import { EnemyIconComponent } from '../../shared/ui/enemy-icon/enemy-icon.component';

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

  readonly battleStatus = this.battleService.battleStatus;
  readonly aliveEnemies = this.battleService.aliveEnemies;
  readonly currentRound = this.battleService.currentRound;
  readonly currentEnemy = this.battleService.currentEnemy;

  statusEffects(enemy: Enemy): string[] {
    // Firebase omits empty objects, so `status` may be missing entirely.
    return Object.keys(enemy.status ?? {});
  }
}
