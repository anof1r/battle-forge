export type CharacterStatKey = 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha';

export type CharacterSkillProficiency = 'proficient' | 'expertise';

export interface CharacterSkill {
  id: string;
  name: string;
  baseStat: CharacterStatKey;
  proficiency: CharacterSkillProficiency;
  modifier: number;
}

export interface CharacterSkillDefinition {
  id: string;
  name: string;
  baseStat: CharacterStatKey;
}
