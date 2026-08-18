import { LibrarySource } from './library-source.model';

export interface SpellTemplate {
  id: string;
  name: string;
  level: number;
  school: string;
  description: string;
  higherLevel: string;
  damageFormula: string;
  damageType: string;
  castingTime: string;
  range: string;
  duration: string;
  components: string;
  isCantrip: boolean;
  isRitual: boolean;
  requiresConcentration: boolean;
  source: LibrarySource;
  createdAt: number;
  lastUpdated: number;
}

export type SpellTemplateDraft = Omit<SpellTemplate, 'createdAt' | 'lastUpdated'>;
