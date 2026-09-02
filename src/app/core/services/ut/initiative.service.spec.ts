import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { COMBATANT_STATUS, COMBATANT_TYPE } from '../../constants/combatant.constants';
import { Combatant } from '../../models/combatant.model';
import { RealtimeDataService } from '../realtime-data.service';
import { InitiativeService } from '../initiative.service';

describe('InitiativeService', () => {
  let service: InitiativeService;
  let realtimeData: { update: ReturnType<typeof vi.fn> };

  const combatant = (id: string, initiative: number): Combatant => ({
    id,
    name: id,
    initiative,
    type: COMBATANT_TYPE.ENEMY,
    status: COMBATANT_STATUS.ALIVE,
    currentHp: 10,
    maxHp: 10,
    ac: 12,
  });

  beforeEach(() => {
    realtimeData = { update: vi.fn().mockResolvedValue(undefined) };
    TestBed.configureTestingModule({
      providers: [
        InitiativeService,
        { provide: RealtimeDataService, useValue: realtimeData },
      ],
    });
    service = TestBed.inject(InitiativeService);
    vi.spyOn(Date, 'now').mockReturnValue(1234);
  });

  it('writes initiative order from highest to lowest', async () => {
    await service.sortByInitiative('rooms/main', {
      slow: combatant('slow', 4),
      fast: combatant('fast', 18),
      middle: combatant('middle', 11),
    });

    expect(realtimeData.update).toHaveBeenCalledWith('rooms/main', {
      initiativeOrder: ['fast', 'middle', 'slow'],
      lastUpdated: 1234,
    });
  });

  it('updates only the selected combatant initiative', async () => {
    await service.setInitiative('rooms/main', 'goblin-1', 17);

    expect(realtimeData.update).toHaveBeenCalledWith('rooms/main/combatants/goblin-1', {
      initiative: 17,
      lastUpdated: 1234,
    });
  });
});
