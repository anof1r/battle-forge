import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { COMBATANT_STATUS, COMBATANT_TYPE } from '../../../core/constants/combatant.constants';
import { STATUS_EFFECT_TRIGGER } from '../../../core/constants/status-effect.constants';
import { Combatant } from '../../../core/models/combatant.model';
import { BattleService } from '../../../core/services/battle.service';
import { LoggerService } from '../../../core/services/logger.service';
import { DmStatusEffectsComponent } from './dm-status-effects.component';

describe('DmStatusEffectsComponent', () => {
  const goblin: Combatant = {
    id: 'goblin',
    type: COMBATANT_TYPE.ENEMY,
    name: 'Goblin',
    initiative: 12,
    ac: 12,
    maxHp: 7,
    currentHp: 7,
    status: COMBATANT_STATUS.ALIVE,
  };
  const createBattle = () => ({
    sortedCombatants: signal([goblin]),
    combatants: signal({ [goblin.id]: goblin }),
    addStatusEffect: vi.fn().mockResolvedValue(true),
    removeStatusEffect: vi.fn().mockResolvedValue(true),
  });

  let battle: ReturnType<typeof createBattle>;
  let component: DmStatusEffectsComponent;

  beforeEach(() => {
    battle = createBattle();
    TestBed.configureTestingModule({
      imports: [DmStatusEffectsComponent],
      providers: [
        { provide: BattleService, useValue: battle },
        { provide: LoggerService, useValue: { error: vi.fn() } },
      ],
    });
    component = TestBed.createComponent(DmStatusEffectsComponent).componentInstance;
  });

  it('assigns a configured effect and clears optional fields after success', async () => {
    component.selectedTargetId.set(goblin.id);
    component.selectEffect('poisoned');
    component.damage.set(3);
    component.duration.set(2);
    component.source.set('Trap');

    component.applyEffect();

    await vi.waitFor(() =>
      expect(battle.addStatusEffect).toHaveBeenCalledWith(goblin.id, 'poisoned', {
        damagePerTrigger: 3,
        durationTriggers: 2,
        trigger: STATUS_EFFECT_TRIGGER.TURN_START,
        source: 'Trap',
        concentrationSourceId: undefined,
        saveAbility: '',
        saveDc: 0,
        notes: '',
      }),
    );
    expect(component.damage()).toBe(0);
    expect(component.duration()).toBe(0);
    expect(component.source()).toBe('');
  });

  it('reports a duplicate effect without clearing the configured form', async () => {
    battle.addStatusEffect.mockResolvedValue(false);
    component.selectedTargetId.set(goblin.id);
    component.damage.set(4);

    component.applyEffect();

    await vi.waitFor(() => expect(component.error()).toContain('уже назначен'));
    expect(component.damage()).toBe(4);
  });

  it('removes an active effect through BattleService', async () => {
    component.removeEffect(goblin.id, 'effect-1');

    await vi.waitFor(() =>
      expect(battle.removeStatusEffect).toHaveBeenCalledWith(goblin.id, 'effect-1'),
    );
    expect(component.removingEffectId()).toBeNull();
  });
});
