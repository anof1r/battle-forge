import { Injectable, inject } from '@angular/core';
import { RealtimeDataService } from './realtime-data.service';
import { Combatant } from '../models/combatant.model';
import { sortByInitiativeDesc, withTimestamp } from '../utils';

@Injectable({ providedIn: 'root' })
export class InitiativeService {
  private readonly realtimeData = inject(RealtimeDataService);

  async sortByInitiative(roomPath: string, combatants: Record<string, Combatant>): Promise<void> {
    await this.realtimeData.update(
      roomPath,
      withTimestamp({ initiativeOrder: sortByInitiativeDesc(combatants) }),
    );
  }

  async setInitiative(roomPath: string, combatantId: string, initiative: number): Promise<void> {
    await this.realtimeData.update(
      `${roomPath}/combatants/${combatantId}`,
      withTimestamp({ initiative }),
    );
  }
}
