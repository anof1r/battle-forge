export interface DisplaySettings {
  showEnemyArmorClass: boolean;
  showEnemyHealth: boolean;
  lastUpdated: number;
}

export type DisplayVisibilitySetting = 'showEnemyArmorClass' | 'showEnemyHealth';

export const DEFAULT_DISPLAY_SETTINGS: DisplaySettings = {
  showEnemyArmorClass: true,
  showEnemyHealth: true,
  lastUpdated: 0,
};
