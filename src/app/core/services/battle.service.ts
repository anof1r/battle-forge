import { Injectable, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FirebaseService } from './firebase.service';
import { InitiativeService } from './initiative.service';
import { DamageCalculationService } from './damage-calculation.service';
import { BattleAction, BattleRoom } from '../models';
import { Combatant } from '../models/combatant.model';
import { ParsedCharacter } from '../models/character.model';
import { CharacterService } from './character.service';
import { BATTLE_STATUS } from '../constants/battle-status.constants';
import { COMBATANT_STATUS, COMBATANT_TYPE } from '../constants/combatant.constants';
import { BATTLE_ACTION_TYPE } from '../constants/battle-action.constants';
import { MAIN_ROOM_ID, roomPath as buildRoomPath } from '../constants/firebase-paths.constants';
import { withTimestamp } from '../utils';

const EMPTY_ROOM: BattleRoom = {
  status: BATTLE_STATUS.PREPARATION,
  currentRound: 1,
  currentTurnIndex: 0,
  combatants: {},
  initiativeOrder: [],
  lastUpdated: Date.now(),
};

@Injectable({
  providedIn: 'root',
})
export class BattleService {
  private readonly firebaseService = inject(FirebaseService);
  private readonly characterService = inject(CharacterService);
  private readonly initiativeService = inject(InitiativeService);
  private readonly damageCalc = inject(DamageCalculationService);
  private readonly roomPath = buildRoomPath(MAIN_ROOM_ID);
  private readonly actionHistory = signal<BattleAction[]>([]);

  private readonly room = toSignal(this.firebaseService.subscribe<BattleRoom>(this.roomPath), {
    initialValue: null,
  });

  // --- Основные сигналы ---
  readonly battleStatus = computed(() => this.room()?.status ?? BATTLE_STATUS.PREPARATION);
  readonly combatants = computed(() => this.room()?.combatants ?? {});
  readonly initiativeOrder = computed(() => this.room()?.initiativeOrder ?? []);
  readonly currentRound = computed(() => this.room()?.currentRound ?? 1);
  readonly currentTurnIndex = computed(() => this.room()?.currentTurnIndex ?? 0);

  // --- Производные списки ---
  readonly enemies = computed(() => {
    const all = this.combatants();
    return Object.fromEntries(
      Object.entries(all).filter(([, c]) => c.type === COMBATANT_TYPE.ENEMY),
    );
  });

  readonly playersInBattle = computed(() => {
    const all = this.combatants();
    return Object.fromEntries(
      Object.entries(all).filter(([, c]) => c.type === COMBATANT_TYPE.PLAYER),
    );
  });

  readonly sortedCombatants = computed(() => {
    const map = this.combatants();
    return this.initiativeOrder()
      .map((id) => map[id])
      .filter((c) => c !== undefined);
  });

  readonly sortedEnemies = computed(() => {
    return this.sortedCombatants().filter((c) => c.type === COMBATANT_TYPE.ENEMY);
  });

  readonly aliveEnemies = computed(() => {
    return this.sortedEnemies().filter((e) => e.status === COMBATANT_STATUS.ALIVE);
  });

  readonly currentCombatant = computed(() => {
    const list = this.sortedCombatants();
    return list[this.currentTurnIndex()] ?? null;
  });

  readonly canUndo = computed(() => this.actionHistory().length > 0);

  constructor() {
    void this.ensureRoomExists();
  }

  private async ensureRoomExists(): Promise<void> {
    const existing = await this.firebaseService.get<BattleRoom>(this.roomPath);
    if (!existing) {
      await this.firebaseService.set(this.roomPath, withTimestamp(EMPTY_ROOM));
    }
  }

  // --- Методы для врагов ---
  async addEnemy(
    enemyData: Omit<Combatant, 'id' | 'initiative' | 'currentHp' | 'status' | 'lastUpdated'>,
  ): Promise<string> {
    const id = `enemy_${crypto.randomUUID()}`;
    const combatant: Combatant = {
      id,
      initiative: 0,
      currentHp: enemyData.maxHp,
      status: COMBATANT_STATUS.ALIVE,
      lastUpdated: Date.now(),
      ...enemyData,
    };
    await this.firebaseService.set(`${this.roomPath}/combatants/${id}`, combatant);
    await this.appendToInitiativeOrder(id);
    return id;
  }

  async removeEnemy(enemyId: string): Promise<void> {
    await this.firebaseService.remove(`${this.roomPath}/combatants/${enemyId}`);
    await this.removeFromInitiativeOrder(enemyId);
  }

  async updateEnemy(enemyId: string, updates: Partial<Combatant>): Promise<void> {
    const enemy = this.combatants()[enemyId];
    if (!enemy) return;
    await this.firebaseService.update(
      `${this.roomPath}/combatants/${enemyId}`,
      withTimestamp(updates),
    );
  }

  // --- Методы для игроков ---
  async addPlayerToBattle(player: ParsedCharacter, initiative: number): Promise<void> {
    const id = `player_${player.name}`;
    if (this.combatants()[id]) return;
    const combatant: Combatant = {
      id,
      type: COMBATANT_TYPE.PLAYER,
      name: player.name,
      initiative,
      ac: player.ac,
      maxHp: player.maxHp,
      currentHp: player.maxHp,
      status: COMBATANT_STATUS.ALIVE,
      playerName: player.name,
      emoji: '🧙',
      lastUpdated: Date.now(),
    };
    await this.firebaseService.set(`${this.roomPath}/combatants/${id}`, combatant);
    await this.appendToInitiativeOrder(id);
  }

  async removePlayerFromBattle(playerName: string): Promise<void> {
    const id = `player_${playerName}`;
    await this.firebaseService.remove(`${this.roomPath}/combatants/${id}`);
    await this.removeFromInitiativeOrder(id);
  }

  async sortInitiative(): Promise<void> {
    await this.initiativeService.sortByInitiative(this.roomPath, this.combatants());
  }

  // --- Общие методы ---
  async setInitiative(combatantId: string, initiative: number): Promise<void> {
    await this.initiativeService.setInitiative(this.roomPath, combatantId, initiative);
  }

  async rollInitiative(): Promise<void> {
    await this.initiativeService.sortByInitiative(this.roomPath, this.combatants());
    await this.firebaseService.update(
      this.roomPath,
      withTimestamp({
        status: BATTLE_STATUS.INITIATIVE,
        currentRound: 1,
        currentTurnIndex: 0,
      }),
    );
  }

  async startBattle(): Promise<void> {
    await this.firebaseService.update(
      this.roomPath,
      withTimestamp({ status: BATTLE_STATUS.BATTLE }),
    );
  }

  async takeDamage(combatantId: string, damage: number): Promise<void> {
    const c = this.combatants()[combatantId];
    if (!c) return;
    const newHp = this.damageCalc.applyDamage(c.currentHp, damage);
    await this.firebaseService.update(
      `${this.roomPath}/combatants/${combatantId}`,
      withTimestamp({ currentHp: newHp }),
    );

    if (c.type === COMBATANT_TYPE.PLAYER && c.playerName) {
      await this.characterService.updatePlayerHp(c.playerName, newHp);
    }

    this.logAction({
      type: BATTLE_ACTION_TYPE.DAMAGE,
      targetId: combatantId,
      value: damage,
      description: `${c.name} takes ${damage} damage (${newHp}/${c.maxHp} HP)`,
      reversible: true,
      previousValue: c.currentHp,
    });
  }

  async damageAll(damage: number): Promise<void> {
    const targets = this.aliveEnemies();
    if (targets.length === 0) return;
    const now = Date.now();
    const updates: Record<string, unknown> = {};
    for (const enemy of targets) {
      updates[`combatants/${enemy.id}/currentHp`] = this.damageCalc.applyDamage(
        enemy.currentHp,
        damage,
      );
      updates[`combatants/${enemy.id}/lastUpdated`] = now;
    }
    await this.firebaseService.update(this.roomPath, updates);
    this.logAction({
      type: BATTLE_ACTION_TYPE.DAMAGE,
      targetId: 'all',
      value: damage,
      description: `All enemies take ${damage} damage!`,
      reversible: false,
    });
  }

  async heal(combatantId: string, amount: number): Promise<void> {
    const c = this.combatants()[combatantId];
    if (!c) return;
    const newHp = this.damageCalc.applyHeal(c.currentHp, amount, c.maxHp);
    await this.firebaseService.update(
      `${this.roomPath}/combatants/${combatantId}`,
      withTimestamp({ currentHp: newHp }),
    );
    this.logAction({
      type: BATTLE_ACTION_TYPE.HEAL,
      targetId: combatantId,
      value: amount,
      description: `${c.name} heals ${amount} HP (${newHp}/${c.maxHp} HP)`,
      reversible: true,
      previousValue: c.currentHp,
    });
  }

  async nextTurn(): Promise<void> {
    const order = this.initiativeOrder();
    const nextIndex = this.currentTurnIndex() + 1;
    const isNewRound = nextIndex >= order.length;
    await this.firebaseService.update(
      this.roomPath,
      withTimestamp({
        currentTurnIndex: isNewRound ? 0 : nextIndex,
        currentRound: isNewRound ? this.currentRound() + 1 : this.currentRound(),
      }),
    );
  }

  async undoLastAction(): Promise<void> {
    const last = this.actionHistory().at(-1);
    if (!last?.reversible || last.previousValue === undefined) return;
    await this.firebaseService.update(
      `${this.roomPath}/combatants/${last.targetId}`,
      withTimestamp({ currentHp: last.previousValue }),
    );
    this.actionHistory.update((history) => history.slice(0, -1));
  }

  async endBattle(): Promise<void> {
    await this.firebaseService.update(
      this.roomPath,
      withTimestamp({ status: BATTLE_STATUS.ENDED }),
    );
  }

  async resetScene(): Promise<void> {
    await this.firebaseService.set(this.roomPath, withTimestamp(EMPTY_ROOM));
    this.actionHistory.set([]);
  }

  private async appendToInitiativeOrder(combatantId: string): Promise<void> {
    const currentOrder = this.initiativeOrder();
    if (currentOrder.includes(combatantId)) return;
    await this.firebaseService.update(
      this.roomPath,
      withTimestamp({ initiativeOrder: [...currentOrder, combatantId] }),
    );
  }

  private async removeFromInitiativeOrder(combatantId: string): Promise<void> {
    const order = this.initiativeOrder().filter((id) => id !== combatantId);
    await this.firebaseService.update(this.roomPath, withTimestamp({ initiativeOrder: order }));
  }

  private logAction(action: Omit<BattleAction, 'id' | 'timestamp'>): void {
    const entry: BattleAction = { id: crypto.randomUUID(), timestamp: Date.now(), ...action };
    this.actionHistory.update((history) => [...history.slice(-49), entry]);
  }
}
