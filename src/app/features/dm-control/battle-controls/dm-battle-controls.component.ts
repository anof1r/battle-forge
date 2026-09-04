import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  output,
  signal,
} from '@angular/core';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { BATTLE_STATUS } from '../../../core/constants/battle-status.constants';
import { SceneTransitionMode } from '../../../core/models';
import { BattleService } from '../../../core/services/battle.service';
import { CharacterService } from '../../../core/services/character.service';
import { LoggerService } from '../../../core/services/logger.service';

@Component({
  selector: 'app-dm-battle-controls',
  standalone: true,
  imports: [TranslocoPipe],
  templateUrl: './dm-battle-controls.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DmBattleControlsComponent implements OnInit {
  private readonly battleService = inject(BattleService);
  private readonly characterService = inject(CharacterService);
  private readonly logger = inject(LoggerService);
  private readonly i18n = inject(TranslocoService);

  readonly initiativeRequested = output<Record<string, number>>();
  readonly initiativeClosed = output<void>();
  readonly sceneFinished = output<void>();

  readonly BATTLE_STATUS = BATTLE_STATUS;
  readonly battleStatus = this.battleService.battleStatus;
  readonly canUndo = this.battleService.canUndo;
  readonly enemiesList = computed(() => Object.values(this.battleService.enemies()));

  readonly playersLoading = signal(false);
  readonly playerSyncMessage = signal<string | null>(null);
  readonly playerSyncError = signal<string | null>(null);
  readonly advancingTurn = signal(false);
  readonly transitioningScene = signal(false);

  ngOnInit(): void {
    void this.syncPlayers(false);
  }

  loadPlayersToBattle(): void {
    void this.syncPlayers(true);
  }

  startInitiativeRolls(): void {
    const rolls: Record<string, number> = {};
    for (const enemy of this.enemiesList()) {
      rolls[enemy.id] = Math.floor(Math.random() * 20) + 1;
    }
    this.initiativeRequested.emit(rolls);
  }

  startBattle(): void {
    this.battleService
      .startBattle()
      .catch((error: unknown) => this.logger.error('DmBattleControlsComponent.startBattle', error));
  }

  nextTurn(): void {
    if (this.advancingTurn()) return;
    this.advancingTurn.set(true);
    this.battleService
      .nextTurn()
      .catch((error: unknown) => this.logger.error('DmBattleControlsComponent.nextTurn', error))
      .finally(() => this.advancingTurn.set(false));
  }

  undoLastAction(): void {
    this.battleService
      .undoLastAction()
      .catch((error: unknown) =>
        this.logger.error('DmBattleControlsComponent.undoLastAction', error),
      );
  }

  finishScene(mode: SceneTransitionMode): void {
    if (this.transitioningScene()) return;
    const messageKey =
      mode === 'long-rest'
        ? 'longRest'
        : mode === 'short-rest'
          ? 'shortRest'
          : 'keepHp';
    if (!globalThis.confirm(this.i18n.translate('battleControls.confirmFinish.' + messageKey))) return;

    this.transitioningScene.set(true);
    this.battleService
      .finishScene(mode)
      .then(() => {
        this.initiativeClosed.emit();
        this.sceneFinished.emit();
      })
      .catch((error: unknown) =>
        this.logger.error('DmBattleControlsComponent.finishScene', error),
      )
      .finally(() => this.transitioningScene.set(false));
  }

  resetScene(): void {
    if (!globalThis.confirm(this.i18n.translate('battleControls.confirmReset'))) return;
    this.battleService
      .resetScene()
      .then(() => this.initiativeClosed.emit())
      .catch((error: unknown) => this.logger.error('DmBattleControlsComponent.resetScene', error));
  }

  private async syncPlayers(showFeedback: boolean): Promise<void> {
    if (this.playersLoading()) return;
    this.playersLoading.set(true);
    this.playerSyncError.set(null);
    if (showFeedback) this.playerSyncMessage.set(null);

    try {
      const players = await this.characterService.getAllPlayers();
      await this.battleService.syncPlayersToBattle(players);
      if (showFeedback) {
        this.playerSyncMessage.set(
          players.length > 0
            ? this.i18n.translate('battleControls.feedback.playersUpdated', { count: players.length })
            : this.i18n.translate('battleControls.feedback.noPlayers'),
        );
      }
    } catch (error) {
      this.logger.error('DmBattleControlsComponent.loadPlayersToBattle', error);
      this.playerSyncError.set(this.i18n.translate('battleControls.error.loadPlayers'));
    } finally {
      this.playersLoading.set(false);
    }
  }
}
