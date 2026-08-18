import { EnemyAction } from './enemy.model';
import { LibrarySource } from './library-source.model';

export interface EnemyActionTemplate extends EnemyAction {
  id: string;
  source: LibrarySource;
  createdAt: number;
  lastUpdated: number;
}

export type EnemyActionTemplateDraft = Omit<EnemyActionTemplate, 'createdAt' | 'lastUpdated'>;
