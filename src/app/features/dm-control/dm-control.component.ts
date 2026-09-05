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
import { DmCharacterResourcesComponent } from './character-resources/dm-character-resources.component';
import { DmItemGrantComponent } from './item-grant/dm-item-grant.component';
import { DmItemLibraryComponent } from './item-library/dm-item-library.component';
import { DmOpen5eImportComponent } from './open5e-import/dm-open5e-import.component';
import { DmSceneLibraryComponent } from './scene-library/dm-scene-library.component';
import { DmSpellGrantComponent } from './spell-grant/dm-spell-grant.component';
import { DmStoryComponent } from './story/dm-story.component';
import { DmBattleWorkspaceComponent } from './battle-workspace/dm-battle-workspace.component';
import { DmWorkspacePanel } from './dm-control.model';
import { LanguageSwitcherComponent } from '../../shared/ui/language-switcher/language-switcher.component';

@Component({
  selector: 'app-dm-control',
  standalone: true,
  imports: [
    TranslocoPipe,
    DmBattleWorkspaceComponent,
    DmCharacterResourcesComponent,
    DmItemGrantComponent,
    DmItemLibraryComponent,
    DmOpen5eImportComponent,
    DmSceneLibraryComponent,
    DmSpellGrantComponent,
    DmStoryComponent,
    LanguageSwitcherComponent,
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

  readonly battleStatus = this.battleService.battleStatus;
  readonly currentRound = this.battleService.currentRound;
  readonly currentCombatant = this.battleService.currentCombatant;
  readonly battleParticipantCount = computed(
    () =>
      this.battleService.aliveEnemies().length +
      Object.keys(this.battleService.playersInBattle()).length,
  );
}
