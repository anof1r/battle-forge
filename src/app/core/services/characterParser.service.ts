import { Injectable, inject } from '@angular/core';
import {
  CharacterAbility,
  CharacterStats,
  CharacterWeapon,
  ParsedCharacter,
} from '../models/character.model';
import {
  LssCharacterData,
  LssCharacterSheet,
  LssTextNode,
} from '../models/lss-character.model';
import {
  CharacterSkill,
  CharacterStatKey,
} from '../models/character-skill.model';
import { LoggerService } from './logger.service';
import {
  formatWeaponDamageFormula,
  getAutomaticSpellSlots,
  parseJsonWithTrailingCommaRecovery,
  getCharacterProficiencyBonus,
} from '../utils';
import {
  DEFAULT_ABILITY_NAME,
  DEFAULT_AC,
  DEFAULT_DAMAGE_TYPE,
  DEFAULT_MAX_HP,
  DEFAULT_SPEED,
  DEFAULT_STAT_SCORE,
  DEFAULT_WEAPON_DAMAGE,
  DEFAULT_WEAPON_NAME,
  UNKNOWN_CHARACTER_NAME,
  UNKNOWN_CLASS_OR_RACE,
} from '../constants/character-parser.constants';
import {
  CHARACTER_SKILL_DEFINITIONS,
  CHARACTER_STAT_KEYS,
  LSS_SKILL_PROFICIENCY_TARGET_PREFIX,
} from '../constants/character-skill.constants';

export type { ParsedCharacter } from '../models/character.model';

@Injectable({ providedIn: 'root' })
export class CharacterParserService {
  private readonly logger = inject(LoggerService);

  parseCharacter(jsonData: LssCharacterSheet): ParsedCharacter {
    const dataObj = this.resolveDataObject(jsonData);

    const name = dataObj.name?.value ?? UNKNOWN_CHARACTER_NAME;
    const charClass = dataObj.info?.charClass?.value ?? UNKNOWN_CLASS_OR_RACE;
    const level = dataObj.info?.level?.value ?? 1;
    const race = dataObj.info?.race?.value ?? UNKNOWN_CLASS_OR_RACE;

    const parsedStats = this.parseStats(dataObj);

    const vitality = dataObj.vitality ?? {};
    const baseMaxHp = vitality['hp-max']?.value ?? DEFAULT_MAX_HP;
    const constitutionHpBonus = this.getModifier(parsedStats.con) * Math.max(1, level);
    const maxHp = Math.max(1, baseMaxHp + constitutionHpBonus);
    const currentHp = Math.min(maxHp, Math.max(0, vitality['hp-current']?.value ?? maxHp));
    const speed = vitality.speed?.value ?? DEFAULT_SPEED;
    const ac = this.parseAc(vitality.ac?.value, parsedStats.dex);

    const weapons = this.parseWeapons(dataObj);
    const { abilities, resistances } = this.parseResourcesAndText(dataObj);

    return {
      name,
      class: charClass,
      level,
      race,
      stats: parsedStats,
      skills: this.parseSkills(dataObj, parsedStats, level),
      maxHp,
      currentHp,
      temporaryHp: 0,
      ac,
      speed,
      weapons,
      resistances,
      abilities,
      spellSlots: getAutomaticSpellSlots(charClass, level),
      // Счётчики классовых ресурсов настраивает DM вручную. Формат LSS для них
      // нестабилен и может содержать заклинания, заметки и вычисляемые значения.
      resources: [],
    };
  }

  getModifier(score: number): number {
    return Math.floor((score - DEFAULT_STAT_SCORE) / 2);
  }

  private resolveDataObject(jsonData: LssCharacterSheet): LssCharacterData {
    if (typeof jsonData.data === 'string') {
      try {
        return parseJsonWithTrailingCommaRecovery<LssCharacterData>(jsonData.data);
      } catch (error) {
        this.logger.error('CharacterParserService.parseCharacter', error);
        return jsonData as LssCharacterData;
      }
    }
    return (jsonData.data ?? (jsonData as unknown as LssCharacterData)) as LssCharacterData;
  }

  private parseStats(dataObj: LssCharacterData): CharacterStats {
    const stats = dataObj.stats ?? {};
    return {
      str: stats.str?.score ?? DEFAULT_STAT_SCORE,
      dex: stats.dex?.score ?? DEFAULT_STAT_SCORE,
      con: stats.con?.score ?? DEFAULT_STAT_SCORE,
      int: stats.int?.score ?? DEFAULT_STAT_SCORE,
      wis: stats.wis?.score ?? DEFAULT_STAT_SCORE,
      cha: stats.cha?.score ?? DEFAULT_STAT_SCORE,
    };
  }

  private parseAc(acFormula: number | string | undefined, dex: number): number {
    if (acFormula === undefined) return DEFAULT_AC;
    if (typeof acFormula === 'number') return acFormula;
    if (acFormula.includes('[DEX]')) {
      return DEFAULT_AC + this.getModifier(dex);
    }
    return DEFAULT_AC;
  }

  private parseWeapons(dataObj: LssCharacterData): CharacterWeapon[] {
    const weaponsList = dataObj.weaponsList ?? [];
    return weaponsList.map((w) => ({
      name: w.name?.value ?? DEFAULT_WEAPON_NAME,
      damage: formatWeaponDamageFormula(w.dmg?.value ?? DEFAULT_WEAPON_DAMAGE, w.ability ?? 'str'),
      damageType: w.dmgType?.value ?? DEFAULT_DAMAGE_TYPE,
    }));
  }

  private parseSkills(
    dataObj: LssCharacterData,
    stats: CharacterStats,
    level: number,
  ): CharacterSkill[] {
    const rawSkills = dataObj.skills ?? {};
    const proficiencyBonus = this.parseProficiencyBonus(dataObj, level);
    const bonusRanks = this.parseSkillProficiencyBonusRanks(dataObj);
    const skillIds = new Set([
      ...Object.keys(rawSkills),
      ...bonusRanks.keys(),
    ]);

    return Array.from(skillIds).flatMap((id) => {
      const raw = rawSkills[id] ?? {};
      const embeddedRank = raw.isProf === 2
        ? 2
        : raw.isProf === true || raw.isProf === 1
          ? 1
          : 0;
      const rank = Math.max(embeddedRank, bonusRanks.get(id) ?? 0);
      if (rank === 0) return [];

      const definition = CHARACTER_SKILL_DEFINITIONS.find((skill) => skill.id === id);
      const baseStat = this.isCharacterStatKey(raw.baseStat)
        ? raw.baseStat
        : definition?.baseStat;
      if (!baseStat) return [];

      const customModifier = this.finiteNumber(raw.customModifier);
      const legacyBonus = this.finiteNumber(raw.bonus) ?? 0;
      const rawName = typeof raw.name === 'string' ? raw.name.trim() : '';
      const modifier = customModifier
        ?? this.getModifier(stats[baseStat]) + proficiencyBonus * rank + legacyBonus;

      return [{
        id,
        name: definition?.name ?? (rawName || id),
        baseStat,
        proficiency: rank === 2 ? 'expertise' as const : 'proficient' as const,
        modifier: Math.trunc(modifier),
      }];
    });
  }

  private parseSkillProficiencyBonusRanks(dataObj: LssCharacterData): Map<string, number> {
    const ranks = new Map<string, number>();

    for (const bonus of dataObj.bonuses ?? []) {
      if (
        bonus.disabled
        || typeof bonus.target !== 'string'
        || !bonus.target.startsWith(LSS_SKILL_PROFICIENCY_TARGET_PREFIX)
        || (bonus.mode !== 'upgrade' && bonus.mode !== 'set')
      ) {
        continue;
      }

      const skillId = bonus.target.slice(LSS_SKILL_PROFICIENCY_TARGET_PREFIX.length).trim();
      const rawRank = this.finiteNumber(bonus.value);
      if (!skillId || rawRank === null || rawRank <= 0) continue;

      const rank = Math.min(2, Math.trunc(rawRank));
      ranks.set(skillId, Math.max(ranks.get(skillId) ?? 0, rank));
    }

    return ranks;
  }

  private parseProficiencyBonus(dataObj: LssCharacterData, level: number): number {
    const custom = this.finiteNumber(dataObj.proficiencyCustom);
    const regular = this.finiteNumber(dataObj.proficiency);
    return custom && custom > 0
      ? Math.trunc(custom)
      : regular && regular > 0
        ? Math.trunc(regular)
        : getCharacterProficiencyBonus(level);
  }

  private finiteNumber(value: unknown): number | null {
    const unwrapped =
      value && typeof value === 'object' && 'value' in value
        ? (value as { value?: unknown }).value
        : value;
    if (unwrapped === null || unwrapped === undefined || unwrapped === '') return null;
    const number = typeof unwrapped === 'number' ? unwrapped : Number(unwrapped);
    return Number.isFinite(number) ? number : null;
  }

  private isCharacterStatKey(value: unknown): value is CharacterStatKey {
    return typeof value === 'string'
      && CHARACTER_STAT_KEYS.includes(value as CharacterStatKey);
  }

  private parseResourcesAndText(dataObj: LssCharacterData): {
    abilities: CharacterAbility[];
    resistances: string[];
  } {
    const resources = dataObj.resources ?? {};
    const abilities: CharacterAbility[] = [];
    const resistances: string[] = [];

    Object.values(resources).forEach((res) => {
      if (res.isDeleted) return;
      if (res.name?.toLowerCase().includes('сопротивл')) {
        resistances.push(res.name);
      }
      if (res.name && res.notes) {
        abilities.push({ name: res.name, description: res.notes, source: 'resource' });
      }
    });

    const traitsContent = dataObj.text?.traits?.value?.data?.content;
    if (traitsContent) {
      abilities.push(...this.extractTraits(traitsContent));
    }

    const featsContent = dataObj.text?.feats?.value?.data?.content;
    if (featsContent) {
      const feats = this.extractTraits(featsContent).map((a) => ({
        ...a,
        source: 'feat' as const,
      }));
      abilities.push(...feats);
    }

    const uniqueAbilities = abilities.reduce<CharacterAbility[]>((acc, curr) => {
      if (!acc.some((a) => a.name === curr.name)) acc.push(curr);
      return acc;
    }, []);

    return { abilities: uniqueAbilities, resistances };
  }

  private extractTraits(content: LssTextNode[]): CharacterAbility[] {
    const result: CharacterAbility[] = [];
    if (!Array.isArray(content)) return result;

    for (const block of content) {
      if (block.type !== 'spoiler') continue;

      const summary = block.content?.find((c) => c.type === 'spoilerSummary');
      const details = block.content?.find((c) => c.type === 'spoilerContent');

      let name = DEFAULT_ABILITY_NAME;
      if (summary?.content) {
        const textName = summary.content
          .filter((node) => node.type === 'text')
          .map((node) => node.text ?? '')
          .join(' ');
        const formulaLabel = summary.content
          .find((node) => node.type === 'formula' && node.attrs?.label?.trim())
          ?.attrs?.label?.trim();
        name = textName.trim() || formulaLabel || DEFAULT_ABILITY_NAME;
      }

      let description = '';
      if (details?.content) {
        const textParts: string[] = [];
        const extractText = (nodes: LssTextNode[]): void => {
          for (const node of nodes) {
            if (node.type === 'text' && node.text) textParts.push(node.text);
            if (node.content) extractText(node.content);
          }
        };
        extractText(details.content);
        description = textParts.join(' ').trim();
      }

      if (name && description) {
        result.push({ name, description });
      }
    }
    return result;
  }
}
