import {
  ChangeDetectionStrategy,
  Component,
  ViewEncapsulation,
  computed,
  inject,
  signal,
} from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { BATTLE_STATUS } from '../../core/constants/battle-status.constants';
import { BattleService } from '../../core/services/battle.service';
import { StoryPresentationService } from '../../core/services/story-presentation.service';
import { DmBattleControlsComponent } from './battle-controls/dm-battle-controls.component';
import { DmBattleHistoryComponent } from './battle-history/dm-battle-history.component';
import { DmCharacterResourcesComponent } from './character-resources/dm-character-resources.component';
import { DmCombatantRosterComponent } from './combatant-roster/dm-combatant-roster.component';
import { DmHpControlComponent } from './hp-control/dm-hp-control.component';
import { DmInitiativeComponent } from './initiative/dm-initiative.component';
import { DmItemGrantComponent } from './item-grant/dm-item-grant.component';
import { DmItemLibraryComponent } from './item-library/dm-item-library.component';
import { DmOpen5eImportComponent } from './open5e-import/dm-open5e-import.component';
import { DmSceneLibraryComponent } from './scene-library/dm-scene-library.component';
import { DmSpellGrantComponent } from './spell-grant/dm-spell-grant.component';
import { DmStatusEffectsComponent } from './status-effects/dm-status-effects.component';
import { DmStoryComponent } from './story/dm-story.component';
import { DmWorkspacePanel } from './dm-control.model';

@Component({
  selector: 'app-dm-control',
  standalone: true,
  imports: [
    TranslocoPipe,
    DmBattleControlsComponent,
    DmBattleHistoryComponent,
    DmCharacterResourcesComponent,
    DmCombatantRosterComponent,
    DmHpControlComponent,
    DmInitiativeComponent,
    DmItemGrantComponent,
    DmItemLibraryComponent,
    DmOpen5eImportComponent,
    DmSceneLibraryComponent,
    DmSpellGrantComponent,
    DmStatusEffectsComponent,
    DmStoryComponent,
  ],
  templateUrl: './dm-control.component.html',
  styleUrl: './dm-control.component.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DmControlComponent {
  private readonly battleService = inject(BattleService);

  readonly storyPresentation = inject(StoryPresentationService);
  readonly BATTLE_STATUS = BATTLE_STATUS;
  readonly activePanel = signal<DmWorkspacePanel>('scenes');
  readonly initiativeVisible = signal(false);
  readonly initiativeRolls = signal<Record<string, number>>({});

  readonly battleStatus = this.battleService.battleStatus;
  readonly currentRound = this.battleService.currentRound;
  readonly currentCombatant = this.battleService.currentCombatant;
  readonly battleParticipantCount = computed(
    () =>
      this.battleService.aliveEnemies().length +
      Object.keys(this.battleService.playersInBattle()).length,
  );

  openInitiative(rolls: Record<string, number>): void {
    this.initiativeRolls.set(rolls);
    this.initiativeVisible.set(true);
  }

  closeInitiative(): void {
    this.initiativeVisible.set(false);
  }

  returnToScenes(): void {
    this.closeInitiative();
    this.activePanel.set('scenes');
  }
}
