import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { COMBATANT_STATUS, COMBATANT_TYPE } from '../../../core/constants/combatant.constants';
import { Combatant } from '../../../core/models/combatant.model';
import { BattleService } from '../../../core/services/battle.service';
import { LoggerService } from '../../../core/services/logger.service';
import { DmCombatantRosterComponent } from './dm-combatant-roster.component';

describe('DmCombatantRosterComponent', () => {
  let component: DmCombatantRosterComponent;
  const player: Combatant = {
    id: 'player_Aria',
    type: COMBATANT_TYPE.PLAYER,
    name: 'Aria',
    playerName: 'Aria',
    initiative: 10,
    ac: 14,
    maxHp: 24,
    currentHp: 0,
    status: COMBATANT_STATUS.DOWNED,
  };
  const createBattle = () => ({
    sortedCombatants: signal([player]),
    currentCombatant: signal<Combatant | null>(null),
    removePlayerFromBattle: vi.fn().mockResolvedValue(undefined),
    removeEnemy: vi.fn().mockResolvedValue(undefined),
    setCurrentTurn: vi.fn().mockResolvedValue(true),
    moveCombatant: vi.fn().mockResolvedValue(true),
    recordDeathSave: vi.fn().mockResolvedValue(true),
    revive: vi.fn().mockResolvedValue(true),
  });
  let battle: ReturnType<typeof createBattle>;

  beforeEach(() => {
    battle = createBattle();
    TestBed.configureTestingModule({
      imports: [DmCombatantRosterComponent],
      providers: [
        { provide: BattleService, useValue: battle },
        { provide: LoggerService, useValue: { error: vi.fn() } },
      ],
    });
    component = TestBed.createComponent(DmCombatantRosterComponent).componentInstance;
  });

  it('routes player removal and life-state actions through BattleService', async () => {
    component.removeCombatant(player);
    component.recordDeathSave(player.id, 'success');
    component.reviveCombatant(player.id);

    await vi.waitFor(() => expect(battle.removePlayerFromBattle).toHaveBeenCalledWith('Aria'));
    expect(battle.recordDeathSave).toHaveBeenCalledWith(player.id, 'success');
    expect(battle.revive).toHaveBeenCalledWith(player.id, 1);
    expect(component.lifeStatusLabel(player)).toBe('Без сознания');
  });

  it('supports emergency turn selection and order movement', () => {
    component.setCurrentTurn(player.id);
    component.moveCombatant(player.id, -1);

    expect(battle.setCurrentTurn).toHaveBeenCalledWith(player.id);
    expect(battle.moveCombatant).toHaveBeenCalledWith(player.id, -1);
  });
});
