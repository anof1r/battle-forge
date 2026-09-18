import { computed, inject, Injectable } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { DISPLAY_SETTINGS_PATH } from '../constants/data-paths.constants';
import {
  DEFAULT_DISPLAY_SETTINGS,
  DisplaySettings,
  DisplayVisibilitySetting,
} from '../models/display-settings.model';
import { RealtimeDataService } from './realtime-data.service';

@Injectable({ providedIn: 'root' })
export class DisplaySettingsService {
  private readonly realtimeData = inject(RealtimeDataService);
  private readonly record = toSignal(
    this.realtimeData.subscribe<Partial<DisplaySettings>>(DISPLAY_SETTINGS_PATH),
    { initialValue: null },
  );

  readonly settings = computed<DisplaySettings>(() => {
    const record = this.record();
    return {
      showEnemyArmorClass:
        typeof record?.showEnemyArmorClass === 'boolean'
          ? record.showEnemyArmorClass
          : DEFAULT_DISPLAY_SETTINGS.showEnemyArmorClass,
      showEnemyHealth:
        typeof record?.showEnemyHealth === 'boolean'
          ? record.showEnemyHealth
          : DEFAULT_DISPLAY_SETTINGS.showEnemyHealth,
      lastUpdated:
        typeof record?.lastUpdated === 'number'
          ? record.lastUpdated
          : DEFAULT_DISPLAY_SETTINGS.lastUpdated,
    };
  });

  readonly showEnemyArmorClass = computed(() => this.settings().showEnemyArmorClass);
  readonly showEnemyHealth = computed(() => this.settings().showEnemyHealth);

  async setVisibility(setting: DisplayVisibilitySetting, visible: boolean): Promise<void> {
    await this.realtimeData.update(DISPLAY_SETTINGS_PATH, {
      [setting]: visible,
      lastUpdated: Date.now(),
    });
  }
}
