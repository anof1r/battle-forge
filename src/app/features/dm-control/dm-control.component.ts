import {
  WorkspaceComponent,
  WorkspaceToolDirective,
} from '../../shared/ui/workspace/workspace.component';
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
import { DmPortraitsComponent } from './portraits/dm-portraits.component';
import { DmSceneLibraryComponent } from './scene-library/dm-scene-library.component';
import { DmSpellGrantComponent } from './spell-grant/dm-spell-grant.component';
import { DmStoryComponent } from './story/dm-story.component';
import { DmBattleWorkspaceComponent } from './battle-workspace/dm-battle-workspace.component';
import { DmWorkspacePanel } from './dm-control.model';
import { LanguageSwitcherComponent } from '../../shared/ui/language-switcher/language-switcher.component';
import { DisplaySettingsService } from '../../core/services/display-settings.service';
import { LoggerService } from '../../core/services/logger.service';
import { DisplayVisibilitySetting } from '../../core/models/display-settings.model';

@Component({
  selector: 'app-dm-control',
  standalone: true,
  imports: [
    WorkspaceComponent,
    WorkspaceToolDirective,
    TranslocoPipe,
    DmBattleWorkspaceComponent,
    DmCharacterResourcesComponent,
    DmItemGrantComponent,
    DmItemLibraryComponent,
    DmOpen5eImportComponent,
    DmPortraitsComponent,
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
  private readonly logger = inject(LoggerService);

  readonly displaySettings = inject(DisplaySettingsService);

  readonly storyPresentation = inject(StoryPresentationService);
  readonly BATTLE_STATUS = BATTLE_STATUS;
  readonly activePanel = signal<DmWorkspacePanel>('scenes');
  readonly savingDisplaySetting = signal<DisplayVisibilitySetting | null>(null);
  readonly displaySettingsError = signal(false);

  readonly battleStatus = this.battleService.battleStatus;
  readonly currentRound = this.battleService.currentRound;
  readonly currentCombatant = this.battleService.currentCombatant;
  readonly battleParticipantCount = computed(
    () =>
      this.battleService.aliveEnemies().length +
      Object.keys(this.battleService.playersInBattle()).length,
  );

  async setDisplayVisibility(setting: DisplayVisibilitySetting, event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    this.savingDisplaySetting.set(setting);
    this.displaySettingsError.set(false);
    try {
      await this.displaySettings.setVisibility(setting, input.checked);
    } catch (error) {
      input.checked = this.displaySettings.settings()[setting];
      this.displaySettingsError.set(true);
      this.logger.error('DmControlComponent.setDisplayVisibility', error);
    } finally {
      this.savingDisplaySetting.set(null);
    }
  }
}
