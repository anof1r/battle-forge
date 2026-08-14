import { describe, expect, it } from 'vitest';
import { DamageCalculationService } from '../damage-calculation.service';

describe('DamageCalculationService', () => {
  const service = new DamageCalculationService();

  it('subtracts damage without allowing HP below zero', () => {
    expect(service.applyDamage(12, 5)).toBe(7);
    expect(service.applyDamage(3, 10)).toBe(0);
  });

  it('adds healing without allowing HP above maximum', () => {
    expect(service.applyHeal(4, 3, 10)).toBe(7);
    expect(service.applyHeal(9, 5, 10)).toBe(10);
  });
});
