import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { COMBATANT_STATUS, COMBATANT_TYPE } from '../../../core/constants/combatant.constants';
import { Combatant } from '../../../core/models/combatant.model';
import { BattleService } from '../../../core/services/battle.service';
import { LoggerService } from '../../../core/services/logger.service';
import { DmInitiativeComponent } from './dm-initiative.component';

describe('DmInitiativeComponent', () => {
  const goblin: Combatant = {
    id: 'goblin',
    type: COMBATANT_TYPE.ENEMY,
    name: 'Goblin',
    initiative: 4,
    ac: 12,
    maxHp: 7,
    currentHp: 7,
    status: COMBATANT_STATUS.ALIVE,
  };

  it('persists generated and edited values before confirming initiative', async () => {
    const battle = {
      combatants: signal({ goblin }),
      setInitiative: vi.fn().mockResolvedValue(undefined),
      rollInitiative: vi.fn().mockResolvedValue(undefined),
    };
    TestBed.configureTestingModule({
      imports: [DmInitiativeComponent],
      providers: [
        { provide: BattleService, useValue: battle },
        { provide: LoggerService, useValue: { error: vi.fn() } },
      ],
    });
    const fixture = TestBed.createComponent(DmInitiativeComponent);
    fixture.componentRef.setInput('visible', true);
    fixture.componentRef.setInput('rolls', { goblin: 11 });
    fixture.detectChanges();
    const component = fixture.componentInstance;
    component.onInitiativeInput('goblin', { target: { value: '16' } } as unknown as Event);
    const closed = vi.spyOn(component.closed, 'emit');

    component.confirmInitiative();

    await vi.waitFor(() => expect(battle.setInitiative).toHaveBeenCalledWith('goblin', 16));
    expect(battle.rollInitiative).toHaveBeenCalledOnce();
    expect(closed).toHaveBeenCalledOnce();
    expect(component.saving()).toBe(false);
  });
});
