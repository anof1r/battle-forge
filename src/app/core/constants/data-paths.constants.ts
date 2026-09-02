/** Stable logical paths shared by the client and the Mongo compatibility API. */
export const DATA_ROOT = {
  ROOMS: 'rooms',
  PLAYERS: 'players',
  CREATURE_TEMPLATES: 'dm-library/creatures',
  SCENE_PRESETS: 'dm-library/scenes',
  ITEM_TEMPLATES: 'dm-library/items',
  SPELL_TEMPLATES: 'dm-library/spells',
  ENEMY_ACTION_TEMPLATES: 'dm-library/enemy-actions',
  MAIN_STORY_SECTIONS: 'dm-library/stories/main/sections',
} as const;

export const MAIN_ROOM_ID = 'main-room';

export function roomPath(roomId: string): string {
  return `${DATA_ROOT.ROOMS}/${roomId}`;
}

export function playerPath(playerName: string): string {
  return `${DATA_ROOT.PLAYERS}/${playerName}`;
}

export function creatureTemplatePath(templateId: string): string {
  return `${DATA_ROOT.CREATURE_TEMPLATES}/${templateId}`;
}

export function scenePresetPath(sceneId: string): string {
  return `${DATA_ROOT.SCENE_PRESETS}/${sceneId}`;
}

export function itemTemplatePath(templateId: string): string {
  return `${DATA_ROOT.ITEM_TEMPLATES}/${templateId}`;
}

export function spellTemplatePath(templateId: string): string {
  return `${DATA_ROOT.SPELL_TEMPLATES}/${templateId}`;
}

export function enemyActionTemplatePath(templateId: string): string {
  return `${DATA_ROOT.ENEMY_ACTION_TEMPLATES}/${templateId}`;
}

export function mainStorySectionPath(sectionId: string): string {
  return `${DATA_ROOT.MAIN_STORY_SECTIONS}/${sectionId}`;
}
