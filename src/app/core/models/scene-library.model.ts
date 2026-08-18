import { EnemyAbility, EnemyAction } from './enemy.model';
import { LibrarySource } from './library-source.model';

export interface CreatureTemplate {
  id: string;
  name: string;
  subtype: string;
  maxHp: number;
  ac: number;
  actions: EnemyAction[];
  abilities: EnemyAbility[];
  resistances: string[];
  statuses: string[];
  source?: LibrarySource;
  createdAt: number;
  lastUpdated: number;
}

export type CreatureTemplateDraft = Omit<CreatureTemplate, 'id' | 'createdAt' | 'lastUpdated'> & {
  id?: string;
};

export interface ScenePresetEntry {
  templateId: string;
  quantity: number;
}

export interface ScenePreset {
  id: string;
  name: string;
  description: string;
  entries: ScenePresetEntry[];
  createdAt: number;
  lastUpdated: number;
}

export type ScenePresetDraft = Omit<ScenePreset, 'id' | 'createdAt' | 'lastUpdated'> & {
  id?: string;
};

export interface SceneCreatureStack {
  template: CreatureTemplate;
  quantity: number;
}
