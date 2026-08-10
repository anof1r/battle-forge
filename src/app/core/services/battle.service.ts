import { Injectable, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FirebaseService } from './firebase.service';
import { BattleAction, BattleRoom, Enemy, EnemyInput } from '../models';

const EMPTY_ROOM: BattleRoom = {
  status: 'preparation',
  currentRound: 1,
  currentTurnIndex: 0,
  enemies: {},
  initiativeOrder: [],
  lastUpdated: Date.now(),
};

@Injectable({
  providedIn: 'root',
})
export class BattleService {
  private readonly firebaseService = inject(FirebaseService);

  private readonly roomId = 'main-room';
  private readonly roomPath = `rooms/${this.roomId}`;

  private readonly actionHistory = signal<BattleAction[]>([]);

  private readonly room = toSignal(this.firebaseService.subscribe<BattleRoom>(this.roomPath), {
    initialValue: null,
  });

  readonly battleStatus = computed(() => this.room()?.status ?? 'preparation');
  readonly enemies = computed(() => this.room()?.enemies ?? {});
  readonly initiativeOrder = computed(() => this.room()?.initiativeOrder ?? []);
  readonly currentRound = computed(() => this.room()?.currentRound ?? 1);
  readonly currentTurnIndex = computed(() => this.room()?.currentTurnIndex ?? 0);

  readonly aliveEnemies = computed(() =>
    Object.values(this.enemies()).filter((enemy) => enemy.currentHp > 0),
  );

  readonly sortedByInitiative = computed(() => {
    const enemiesMap = this.enemies();
    return this.initiativeOrder()
      .map((id) => enemiesMap[id])
      .filter((enemy): enemy is Enemy => !!enemy);
  });

  readonly currentEnemy = computed(
    () => this.sortedByInitiative()[this.currentTurnIndex()] ?? null,
  );

  readonly canUndo = computed(() => this.actionHistory().length > 0);

  constructor() {
    void this.ensureRoomExists();
  }

  private async ensureRoomExists(): Promise<void> {
    const existing = await this.firebaseService.get<BattleRoom>(this.roomPath);
    if (!existing) {
      await this.firebaseService.set(this.roomPath, { ...EMPTY_ROOM, lastUpdated: Date.now() });
    }
  }

  async addEnemy(input: EnemyInput): Promise<string> {
    const id = crypto.randomUUID();
    const enemy: Enemy = {
      id,
      name: input.name,
      type: input.type,
      maxHp: input.maxHp,
      currentHp: input.maxHp,
      ac: input.ac,
      initiative: 0,
      status: {},
      lastUpdated: Date.now(),
    };

    await this.firebaseService.set(`${this.roomPath}/enemies/${id}`, enemy);
    return id;
  }

  async removeEnemy(enemyId: string): Promise<void> {
    await this.firebaseService.remove(`${this.roomPath}/enemies/${enemyId}`);
  }

  async setInitiative(enemyId: string, initiative: number): Promise<void> {
    await this.firebaseService.update(`${this.roomPath}/enemies/${enemyId}`, {
      initiative,
      lastUpdated: Date.now(),
    });
  }

  async rollInitiative(): Promise<void> {
    const sorted = Object.values(this.enemies())
      .sort((a, b) => b.initiative - a.initiative)
      .map((enemy) => enemy.id);

    await this.firebaseService.update(this.roomPath, {
      initiativeOrder: sorted,
      status: 'initiative',
      currentRound: 1,
      currentTurnIndex: 0,
      lastUpdated: Date.now(),
    });
  }

  async startBattle(): Promise<void> {
    await this.firebaseService.update(this.roomPath, {
      status: 'battle',
      lastUpdated: Date.now(),
    });
  }

  async addStatus(enemyId: string, statusName: string, duration = -1): Promise<void> {
    const enemy = this.enemies()[enemyId];
    if (!enemy) return;

    await this.firebaseService.update(`${this.roomPath}/enemies/${enemyId}`, {
      status: { ...(enemy.status ?? {}), [statusName]: { name: statusName, duration } },
      lastUpdated: Date.now(),
    });
  }

  async damageAll(damage: number): Promise<void> {
    const targets = this.aliveEnemies();
    if (targets.length === 0) return;

    const now = Date.now();
    const updates: Record<string, unknown> = {};
    for (const enemy of targets) {
      updates[`enemies/${enemy.id}/currentHp`] = Math.max(0, enemy.currentHp - damage);
      updates[`enemies/${enemy.id}/lastUpdated`] = now;
    }

    await this.firebaseService.update(this.roomPath, updates);

    this.logAction({
      type: 'damage',
      targetId: 'all',
      value: damage,
      description: `All enemies take ${damage} damage!`,
      reversible: false,
    });
  }

  async takeDamage(enemyId: string, damage: number): Promise<void> {
    const enemy = this.enemies()[enemyId];
    if (!enemy) return;

    const newHp = Math.max(0, enemy.currentHp - damage);
    await this.firebaseService.update(`${this.roomPath}/enemies/${enemyId}`, {
      currentHp: newHp,
      lastUpdated: Date.now(),
    });

    this.logAction({
      type: 'damage',
      targetId: enemyId,
      value: damage,
      description: `${enemy.name} takes ${damage} damage (${newHp}/${enemy.maxHp} HP)`,
      reversible: true,
      previousValue: enemy.currentHp,
    });
  }

  async heal(enemyId: string, amount: number): Promise<void> {
    const enemy = this.enemies()[enemyId];
    if (!enemy) return;

    const newHp = Math.min(enemy.maxHp, enemy.currentHp + amount);
    await this.firebaseService.update(`${this.roomPath}/enemies/${enemyId}`, {
      currentHp: newHp,
      lastUpdated: Date.now(),
    });

    this.logAction({
      type: 'heal',
      targetId: enemyId,
      value: amount,
      description: `${enemy.name} heals ${amount} HP (${newHp}/${enemy.maxHp} HP)`,
      reversible: true,
      previousValue: enemy.currentHp,
    });
  }

  async nextTurn(): Promise<void> {
    const order = this.initiativeOrder();
    const nextIndex = this.currentTurnIndex() + 1;
    const isNewRound = nextIndex >= order.length;

    await this.firebaseService.update(this.roomPath, {
      currentTurnIndex: isNewRound ? 0 : nextIndex,
      currentRound: isNewRound ? this.currentRound() + 1 : this.currentRound(),
      lastUpdated: Date.now(),
    });
  }

  async undoLastAction(): Promise<void> {
    const lastAction = this.actionHistory().at(-1);
    if (!lastAction?.reversible || lastAction.previousValue === undefined) return;

    await this.firebaseService.update(`${this.roomPath}/enemies/${lastAction.targetId}`, {
      currentHp: lastAction.previousValue,
      lastUpdated: Date.now(),
    });

    this.actionHistory.update((history) => history.slice(0, -1));
  }

  async endBattle(): Promise<void> {
    await this.firebaseService.update(this.roomPath, {
      status: 'ended',
      lastUpdated: Date.now(),
    });
  }

  async resetScene(): Promise<void> {
    await this.firebaseService.set(this.roomPath, { ...EMPTY_ROOM, lastUpdated: Date.now() });
    this.actionHistory.set([]);
  }

  private logAction(action: Omit<BattleAction, 'id' | 'timestamp'>): void {
    const entry: BattleAction = { id: crypto.randomUUID(), timestamp: Date.now(), ...action };
    this.actionHistory.update((history) => [...history.slice(-49), entry]);
  }
}
