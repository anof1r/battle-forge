import { Injectable } from '@angular/core';
import { EnemyAction, GeneratedEnemyFlavor } from '../models/enemy.model';
import {
  ACTION_DESCRIPTIONS,
  DAMAGE_TYPES,
  ENEMY_DAMAGE_DICE_SIDES,
  RESISTANCE_TYPES,
  STATUS_EFFECTS,
  WEAPON_NAMES,
} from '../constants/enemy-generator.constants';

function randomItem<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickRandomItems<T>(arr: readonly T[], maxCount: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, randomInt(0, Math.min(maxCount, shuffled.length)));
}

/** Generates random flavor data (actions/statuses/resistances) for quickly-stubbed enemies. */
@Injectable({ providedIn: 'root' })
export class EnemyGeneratorService {
  generateFlavor(): GeneratedEnemyFlavor {
    const actionCount = randomInt(1, 3);
    const actions: EnemyAction[] = [];
    for (let i = 0; i < actionCount; i++) {
      const weapon = randomItem(WEAPON_NAMES);
      const damageType = randomItem(DAMAGE_TYPES);
      const description = randomItem(ACTION_DESCRIPTIONS);
      const toHit = randomInt(2, 6);
      const diceCount = randomInt(1, 3);
      const diceSides = randomItem(ENEMY_DAMAGE_DICE_SIDES);
      const damageBonus = randomInt(0, 4);
      const damageFormula = `${diceCount}d${diceSides} + ${damageBonus}`;
      actions.push({
        name: weapon,
        description,
        toHit: `+${toHit}`,
        damage: damageFormula,
        damageType,
        fullText: `${weapon}. ${description}: +${toHit} to hit, reach 5 ft., one target. Hit ${damageFormula} ${damageType} damage.`,
      });
    }
    return {
      actions,
      statuses: pickRandomItems(STATUS_EFFECTS, 2),
      resistances: pickRandomItems(RESISTANCE_TYPES, 2),
    };
  }
}
