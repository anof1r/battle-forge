export interface LssValue<T> {
  value?: T;
}

export interface LssStat {
  score?: number;
}

export interface LssStatsBlock {
  str?: LssStat;
  dex?: LssStat;
  con?: LssStat;
  int?: LssStat;
  wis?: LssStat;
  cha?: LssStat;
}

export interface LssVitalityBlock {
  'hp-max'?: LssValue<number>;
  'hp-current'?: LssValue<number>;
  speed?: LssValue<number>;
  ac?: LssValue<number | string>;
}

export interface LssWeaponEntry {
  name?: LssValue<string>;
  dmg?: LssValue<string | null>;
  dmgType?: LssValue<string>;
  ability?: string;
}

export interface LssResourceEntry {
  id?: string;
  isDeleted?: boolean;
  isShortRest?: boolean;
  isLongRest?: boolean;
  name?: string;
  notes?: string;
  value?: number | LssValue<number>;
  current?: number | LssValue<number>;
  max?: number | LssValue<number>;
  recovery?: string;
}

export interface LssSkillEntry {
  name?: string;
  baseStat?: string;
  isProf?: boolean | 0 | 1 | 2;
  bonus?: number;
  bonusExpr?: string;
  customModifier?: number | string;
  customPassive?: number;
}

export type LssBonusMode = 'add' | 'set' | 'upgrade' | 'downgrade' | 'multiply';

export interface LssCharacterBonus {
  target?: string;
  mode?: LssBonusMode;
  value?: number;
  expr?: string | null;
  disabled?: boolean;
}

export interface LssTextNode {
  type: string;
  text?: string;
  attrs?: {
    formula?: string;
    label?: string;
  };
  content?: LssTextNode[];
}

export interface LssTextBlockValue {
  data?: { content?: LssTextNode[] };
}

export interface LssTextSection {
  traits?: LssValue<LssTextBlockValue>;
  feats?: LssValue<LssTextBlockValue>;
}

export interface LssCharacterData {
  name?: LssValue<string>;
  info?: {
    charClass?: LssValue<string>;
    level?: LssValue<number>;
    race?: LssValue<string>;
  };
  stats?: LssStatsBlock;
  proficiency?: number | LssValue<number>;
  proficiencyCustom?: number | LssValue<number>;
  skills?: Record<string, LssSkillEntry>;
  bonuses?: LssCharacterBonus[];
  vitality?: LssVitalityBlock;
  weaponsList?: LssWeaponEntry[];
  resources?: Record<string, LssResourceEntry>;
  text?: LssTextSection;
}

/** Top-level LSS export payload; data may arrive as an inline object or a JSON string. */
export interface LssCharacterSheet {
  data?: LssCharacterData | string;
  [key: string]: unknown;
}
