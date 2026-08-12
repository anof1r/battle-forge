import { Injectable } from '@angular/core';

/** Pure HP math shared by damage/heal flows — kept dependency-free and easy to unit test. */
@Injectable({ providedIn: 'root' })
export class DamageCalculationService {
  applyDamage(currentHp: number, amount: number): number {
    return Math.max(0, currentHp - amount);
  }

  applyHeal(currentHp: number, amount: number, maxHp: number): number {
    return Math.min(maxHp, currentHp + amount);
  }
}
