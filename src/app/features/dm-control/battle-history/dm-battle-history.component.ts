import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { DatePipe } from '@angular/common';
import { BattleService } from '../../../core/services/battle.service';

@Component({
  selector: 'app-dm-battle-history',
  standalone: true,
  imports: [DatePipe, TranslocoPipe],
  templateUrl: './dm-battle-history.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DmBattleHistoryComponent {
  private readonly battleService = inject(BattleService);
  readonly history = this.battleService.history;
}
