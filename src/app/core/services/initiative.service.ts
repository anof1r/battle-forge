import { Injectable, inject } from '@angular/core';
import { FirebaseService } from './firebase.service';
import { Combatant } from '../models/combatant.model';
import { sortByInitiativeDesc, withTimestamp } from '../utils';

@Injectable({ providedIn: 'root' })
export class InitiativeService {
  private readonly firebaseService = inject(FirebaseService);

  async sortByInitiative(roomPath: string, combatants: Record<string, Combatant>): Promise<void> {
    await this.firebaseService.update(
      roomPath,
      withTimestamp({ initiativeOrder: sortByInitiativeDesc(combatants) }),
    );
  }

  async setInitiative(roomPath: string, combatantId: string, initiative: number): Promise<void> {
    await this.firebaseService.update(
      `${roomPath}/combatants/${combatantId}`,
      withTimestamp({ initiative }),
    );
  }
}
