import { Injectable, inject } from '@angular/core';
import {
  CharacterAbility,
  CharacterStats,
  CharacterWeapon,
  LssCharacterData,
  LssCharacterSheet,
  LssTextNode,
  ParsedCharacter,
} from '../models/character.model';
import { LoggerService } from './logger.service';

export type { ParsedCharacter } from '../models/character.model';

const DEFAULT_STAT_SCORE = 10;
const DEFAULT_MAX_HP = 10;
const DEFAULT_AC = 10;
const DEFAULT_SPEED = 30;
const UNKNOWN_NAME = 'Неизвестный';
const UNKNOWN_CLASS_OR_RACE = 'Неизвестно';
const DEFAULT_WEAPON_NAME = 'Оружие';
const DEFAULT_DAMAGE = '1d4';
const DEFAULT_DAMAGE_TYPE = 'дробящий';
const DEFAULT_ABILITY_SCORE = 'dex';
const DEFAULT_ABILITY_NAME = 'Способность';

@Injectable({ providedIn: 'root' })
export class CharacterParserService {
  private readonly logger = inject(LoggerService);

  parseCharacter(jsonData: LssCharacterSheet): ParsedCharacter {
    const dataObj = this.resolveDataObject(jsonData);

    const name = dataObj.name?.value ?? UNKNOWN_NAME;
    const charClass = dataObj.info?.charClass?.value ?? UNKNOWN_CLASS_OR_RACE;
    const level = dataObj.info?.level?.value ?? 1;
    const race = dataObj.info?.race?.value ?? UNKNOWN_CLASS_OR_RACE;

    const parsedStats = this.parseStats(dataObj);

    const vitality = dataObj.vitality ?? {};
    const maxHp = vitality['hp-max']?.value ?? DEFAULT_MAX_HP;
    const currentHp = vitality['hp-current']?.value ?? maxHp;
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
      maxHp,
      currentHp,
      ac,
      speed,
      weapons,
      resistances,
      abilities,
    };
  }

  getModifier(score: number): number {
    return Math.floor((score - DEFAULT_STAT_SCORE) / 2);
  }

  private resolveDataObject(jsonData: LssCharacterSheet): LssCharacterData {
    if (typeof jsonData.data === 'string') {
      try {
        return JSON.parse(jsonData.data) as LssCharacterData;
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
      damage: w.dmg?.value ?? DEFAULT_DAMAGE,
      damageType: w.dmgType?.value ?? DEFAULT_DAMAGE_TYPE,
      ability: w.ability ?? DEFAULT_ABILITY_SCORE,
    }));
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
        const textParts = summary.content
          .map((c) => (c.type === 'text' ? (c.text ?? '') : (c.attrs?.formula ?? '')))
          .join(' ');
        name = textParts.trim() || DEFAULT_ABILITY_NAME;
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
