import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import {
  COMBATANT_STATUS,
  COMBATANT_TYPE,
  DEATH_SAVE_RESULT,
  DeathSaveResult,
} from '../../../core/constants/combatant.constants';
import { Combatant } from '../../../core/models/combatant.model';
import { BattleService } from '../../../core/services/battle.service';
import { LoggerService } from '../../../core/services/logger.service';

@Component({
  selector: 'app-dm-combatant-roster',
  standalone: true,
  templateUrl: './dm-combatant-roster.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DmCombatantRosterComponent {
  private readonly battleService = inject(BattleService);
  private readonly logger = inject(LoggerService);

  readonly COMBATANT_STATUS = COMBATANT_STATUS;
  readonly COMBATANT_TYPE = COMBATANT_TYPE;
  readonly DEATH_SAVE_RESULT = DEATH_SAVE_RESULT;
  readonly combatants = this.battleService.sortedCombatants;
  readonly currentCombatant = this.battleService.currentCombatant;

  removeCombatant(combatant: Combatant): void {
    const operation = combatant.type === COMBATANT_TYPE.PLAYER
      ? this.battleService.removePlayerFromBattle(combatant.playerName ?? combatant.name)
      : this.battleService.removeEnemy(combatant.id);
    operation.catch((error: unknown) =>
      this.logger.error('DmCombatantRosterComponent.removeCombatant', error),
    );
  }

  setCurrentTurn(combatantId: string): void {
    this.battleService
      .setCurrentTurn(combatantId)
      .catch((error: unknown) =>
        this.logger.error('DmCombatantRosterComponent.setCurrentTurn', error),
      );
  }

  moveCombatant(combatantId: string, direction: -1 | 1): void {
    this.battleService
      .moveCombatant(combatantId, direction)
      .catch((error: unknown) =>
        this.logger.error('DmCombatantRosterComponent.moveCombatant', error),
      );
  }

  recordDeathSave(combatantId: string, result: DeathSaveResult): void {
    this.battleService
      .recordDeathSave(combatantId, result)
      .catch((error: unknown) =>
        this.logger.error('DmCombatantRosterComponent.recordDeathSave', error),
      );
  }

  reviveCombatant(combatantId: string): void {
    this.battleService
      .revive(combatantId, 1)
      .catch((error: unknown) =>
        this.logger.error('DmCombatantRosterComponent.reviveCombatant', error),
      );
  }

  lifeStatusLabel(combatant: Combatant): string {
    switch (combatant.status) {
      case COMBATANT_STATUS.DOWNED:
        return 'Без сознания';
      case COMBATANT_STATUS.STABLE:
        return 'Стабилен';
      case COMBATANT_STATUS.DEAD:
        return 'Погиб';
      default:
        return 'В строю';
    }
  }
}
