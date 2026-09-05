import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { COMBATANT_STATUS, COMBATANT_TYPE } from '../../../core/constants/combatant.constants';
import { Combatant } from '../../../core/models/combatant.model';
import { BattleService } from '../../../core/services/battle.service';
import { LoggerService } from '../../../core/services/logger.service';
import { DmHpControlComponent } from './dm-hp-control.component';

describe('DmHpControlComponent', () => {
  const aria: Combatant = {
    id: 'player_Aria',
    type: COMBATANT_TYPE.PLAYER,
    name: 'Aria',
    playerName: 'Aria',
    initiative: 10,
    ac: 14,
    maxHp: 24,
    currentHp: 20,
    status: COMBATANT_STATUS.ALIVE,
  };
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
    aliveEnemies: signal([goblin]),
    playersInBattle: signal({ [aria.id]: aria }),
    sortedCombatants: signal([goblin, aria]),
    combatants: signal({ [goblin.id]: goblin, [aria.id]: aria }),
    damageAll: vi.fn().mockResolvedValue(undefined),
    damageMany: vi.fn().mockResolvedValue(undefined),
    takeDamage: vi.fn().mockResolvedValue(undefined),
    healMany: vi.fn().mockResolvedValue(undefined),
    heal: vi.fn().mockResolvedValue(undefined),
    setTemporaryHp: vi.fn().mockResolvedValue(undefined),
  });

  let battle: ReturnType<typeof createBattle>;
  let logger: { error: ReturnType<typeof vi.fn> };
  let component: DmHpControlComponent;

  beforeEach(() => {
    battle = createBattle();
    logger = { error: vi.fn() };
    TestBed.configureTestingModule({
      imports: [DmHpControlComponent],
      providers: [
        { provide: BattleService, useValue: battle },
        { provide: LoggerService, useValue: logger },
      ],
    });
    component = TestBed.createComponent(DmHpControlComponent).componentInstance;
  });

  it('applies mass damage and resets only after persistence succeeds', async () => {
    component.setTargetType('all');
    component.amount.set(5);
    component.applyDamage();

    await vi.waitFor(() => expect(battle.damageAll).toHaveBeenCalledWith(5));
    expect(component.amount()).toBe(0);
    expect(component.targetId()).toBeNull();
  });

  it('caps single-target healing at missing HP', () => {
    component.setOperation('heal');
    component.setTargetType('players');
    component.targetId.set(aria.id);

    component.onAmountInput({ target: { value: '99' } } as unknown as Event);

    expect(component.amount()).toBe(4);
    expect(component.maxHealingAmount()).toBe(4);
  });

  it('selects a roster target, clears group selection, and caps a healing draft', () => {
    component.setOperation('heal');
    component.setTargetType('selected');
    component.selectedCombatantIds.set([goblin.id]);
    component.amount.set(12);
    component.selectCombatant(aria);
    expect(component.targetType()).toBe('players');
    expect(component.targetId()).toBe(aria.id);
    expect(component.selectedCombatantIds()).toEqual([]);
    expect(component.amount()).toBe(4);
  });

  it('ignores dead or removed roster targets', () => {
    component.selectCombatant({ ...goblin, status: COMBATANT_STATUS.DEAD });
    expect(component.targetId()).toBeNull();
    component.selectCombatant({ ...goblin, id: 'removed' });
    expect(component.targetId()).toBeNull();
  });

  it('preserves form state and logs a failed write', async () => {
    const error = new Error('denied');
    battle.takeDamage.mockRejectedValue(error);
    component.targetId.set(goblin.id);
    component.amount.set(3);

    component.applyDamage();

    await vi.waitFor(() =>
      expect(logger.error).toHaveBeenCalledWith('DmHpControlComponent.applyDamage', error),
    );
    expect(component.targetId()).toBe(goblin.id);
    expect(component.amount()).toBe(3);
  });
});
