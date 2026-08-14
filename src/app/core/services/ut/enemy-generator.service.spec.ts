import { describe, expect, it, vi } from 'vitest';
import {
  ACTION_DESCRIPTIONS,
  DAMAGE_TYPES,
  RESISTANCE_TYPES,
  STATUS_EFFECTS,
  WEAPON_NAMES,
} from '../../constants/enemy-generator.constants';
import { EnemyGeneratorService } from '../enemy-generator.service';

describe('EnemyGeneratorService', () => {
  const service = new EnemyGeneratorService();

  it('generates values only from supported pools and within configured limits', () => {
    for (let run = 0; run < 50; run++) {
      const flavor = service.generateFlavor();

      expect(flavor.actions.length).toBeGreaterThanOrEqual(1);
      expect(flavor.actions.length).toBeLessThanOrEqual(3);
      expect(flavor.statuses.length).toBeLessThanOrEqual(2);
      expect(flavor.resistances.length).toBeLessThanOrEqual(2);
      expect(new Set(flavor.statuses).size).toBe(flavor.statuses.length);
      expect(new Set(flavor.resistances).size).toBe(flavor.resistances.length);

      for (const action of flavor.actions) {
        expect(WEAPON_NAMES).toContain(action.name);
        expect(ACTION_DESCRIPTIONS).toContain(action.description);
        expect(DAMAGE_TYPES).toContain(action.damageType);
        expect(action.toHit).toMatch(/^\+[2-6]$/);
        expect(action.damage).toMatch(/^[1-3]d(4|6|8|10|12) \+ [0-4]$/);
        expect(action.fullText).toContain(action.name);
      }
      for (const status of flavor.statuses) expect(STATUS_EFFECTS).toContain(status);
      for (const resistance of flavor.resistances) {
        expect(RESISTANCE_TYPES).toContain(resistance);
      }
    }
  });

  it('builds a predictable complete action at the lower random boundary', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);

    expect(service.generateFlavor()).toEqual({
      actions: [
        {
          name: 'Shortsword',
          description: 'Melee Attack',
          toHit: '+2',
          damage: '1d4 + 0',
          damageType: 'slashing',
          fullText:
            'Shortsword. Melee Attack: +2 to hit, reach 5 ft., one target. Hit 1d4 + 0 slashing damage.',
        },
      ],
      statuses: [],
      resistances: [],
    });
  });
});
