import { Injectable, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FirebaseService } from './firebase.service';
import { InitiativeService } from './initiative.service';
import { DamageCalculationService } from './damage-calculation.service';
import { BattleAction, BattleRoom, SceneCreatureStack, SceneTransitionMode } from '../models';
import {
  ActiveStatusEffect,
  Combatant,
  DeathSaves,
  StatusEffectOptions,
} from '../models/combatant.model';
import { ParsedCharacter } from '../models/character.model';
import { CharacterService } from './character.service';
import { BATTLE_STATUS } from '../constants/battle-status.constants';
import {
  COMBATANT_STATUS,
  COMBATANT_TYPE,
  DEATH_SAVE_RESULT,
  DeathSaveResult,
} from '../constants/combatant.constants';
import { BATTLE_ACTION_TYPE } from '../constants/battle-action.constants';
import {
  getStatusEffectDefinition,
  STATUS_EFFECT_TRIGGER,
  StatusEffectTrigger,
  StatusEffectType,
} from '../constants/status-effect.constants';
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

interface ProcessedTurnEffects {
  combatant: Combatant;
  changed: boolean;
}

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
  private turnTransition: Promise<void> | null = null;

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

  readonly currentCombatant = computed<Combatant | null>(() => {
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

  async addCreatureStacks(stacks: readonly SceneCreatureStack[]): Promise<string[]> {
    const validStacks = stacks.filter((stack) => stack.quantity > 0);
    if (validStacks.length === 0) return [];

    const now = Date.now();
    const ids: string[] = [];
    const updates: Record<string, unknown> = {};

    for (const { template, quantity } of validStacks) {
      for (let index = 0; index < quantity; index += 1) {
        const id = `enemy_${crypto.randomUUID()}`;
        ids.push(id);
        updates[`combatants/${id}`] = {
          id,
          type: COMBATANT_TYPE.ENEMY,
          subtype: template.subtype ?? '',
          name: quantity > 1 ? `${template.name} ${index + 1}` : template.name,
          initiative: 0,
          ac: template.ac,
          maxHp: template.maxHp,
          currentHp: template.maxHp,
          status: COMBATANT_STATUS.ALIVE,
          actions: template.actions ?? [],
          abilities: template.abilities ?? [],
          resistances: template.resistances ?? [],
          statuses: template.statuses ?? [],
          lastUpdated: now,
        } satisfies Combatant;
      }
    }

    updates['initiativeOrder'] = [...this.initiativeOrder(), ...ids];
    updates['lastUpdated'] = now;
    await this.firebaseService.update(this.roomPath, updates);
    return ids;
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
    if (this.combatants()[id]) {
      await this.appendToInitiativeOrder(id);
      return;
    }
    const combatant: Combatant = {
      id,
      type: COMBATANT_TYPE.PLAYER,
      name: player.name,
      initiative,
      ac: player.ac,
      maxHp: player.maxHp,
      currentHp: player.currentHp,
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
    if (!c || c.status === COMBATANT_STATUS.DEAD || damage <= 0) return;
    const damaged = this.applyDamageToCombatant(c, damage);
    await this.firebaseService.update(
      `${this.roomPath}/combatants/${combatantId}`,
      withTimestamp({
        currentHp: damaged.currentHp,
        status: damaged.status,
        deathSaves: damaged.deathSaves ?? null,
      }),
    );

    if (c.type === COMBATANT_TYPE.PLAYER && c.playerName) {
      await this.characterService.updatePlayerHp(c.playerName, damaged.currentHp);
    }

    this.logAction({
      type: BATTLE_ACTION_TYPE.DAMAGE,
      targetId: combatantId,
      value: damage,
      description: `${c.name} takes ${damage} damage (${damaged.currentHp}/${c.maxHp} HP)`,
      reversible: true,
      previousValue: c.currentHp,
      previousStatus: c.status,
      previousDeathSaves: c.deathSaves,
    });
  }

  async damageAll(damage: number): Promise<void> {
    const targets = this.aliveEnemies();
    if (targets.length === 0) return;
    const now = Date.now();
    const updates: Record<string, unknown> = {};
    for (const enemy of targets) {
      const damaged = this.applyDamageToCombatant(enemy, damage);
      updates[`combatants/${enemy.id}/currentHp`] = damaged.currentHp;
      updates[`combatants/${enemy.id}/status`] = damaged.status;
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
    if (!c || c.status === COMBATANT_STATUS.DEAD || amount <= 0) return;
    const newHp = this.damageCalc.applyHeal(c.currentHp, amount, c.maxHp);
    const status = newHp > 0 ? COMBATANT_STATUS.ALIVE : c.status;
    await this.firebaseService.update(
      `${this.roomPath}/combatants/${combatantId}`,
      withTimestamp({
        currentHp: newHp,
        status,
        deathSaves: newHp > 0 ? null : c.deathSaves,
      }),
    );
    if (c.type === COMBATANT_TYPE.PLAYER && c.playerName) {
      await this.characterService.updatePlayerHp(c.playerName, newHp);
    }
    this.logAction({
      type: BATTLE_ACTION_TYPE.HEAL,
      targetId: combatantId,
      value: amount,
      description: `${c.name} heals ${amount} HP (${newHp}/${c.maxHp} HP)`,
      reversible: true,
      previousValue: c.currentHp,
      previousStatus: c.status,
      previousDeathSaves: c.deathSaves,
    });
  }

  async recordDeathSave(combatantId: string, result: DeathSaveResult): Promise<boolean> {
    const combatant = this.combatants()[combatantId];
    if (
      !combatant ||
      combatant.type !== COMBATANT_TYPE.PLAYER ||
      combatant.status !== COMBATANT_STATUS.DOWNED
    ) {
      return false;
    }

    const current = combatant.deathSaves ?? { successes: 0, failures: 0 };
    let deathSaves: DeathSaves = { ...current };
    let status: Combatant['status'] = combatant.status;
    let currentHp = combatant.currentHp;

    if (result === DEATH_SAVE_RESULT.CRITICAL_SUCCESS) {
      currentHp = 1;
      status = COMBATANT_STATUS.ALIVE;
      deathSaves = { successes: 0, failures: 0 };
    } else if (result === DEATH_SAVE_RESULT.CRITICAL_FAILURE) {
      deathSaves.failures = Math.min(3, deathSaves.failures + 2);
    } else if (result === DEATH_SAVE_RESULT.SUCCESS) {
      deathSaves.successes = Math.min(3, deathSaves.successes + 1);
    } else {
      deathSaves.failures = Math.min(3, deathSaves.failures + 1);
    }

    if (status !== COMBATANT_STATUS.ALIVE) {
      if (deathSaves.failures >= 3) status = COMBATANT_STATUS.DEAD;
      else if (deathSaves.successes >= 3) status = COMBATANT_STATUS.STABLE;
    }

    await this.firebaseService.update(
      `${this.roomPath}/combatants/${combatantId}`,
      withTimestamp({
        currentHp,
        status,
        deathSaves: status === COMBATANT_STATUS.ALIVE ? null : deathSaves,
      }),
    );
    if (currentHp > 0 && combatant.playerName) {
      await this.characterService.updatePlayerHp(combatant.playerName, currentHp);
    }
    return true;
  }

  async revive(combatantId: string, hp = 1): Promise<boolean> {
    const combatant = this.combatants()[combatantId];
    if (!combatant || combatant.status === COMBATANT_STATUS.ALIVE) return false;

    const currentHp = Math.max(1, Math.min(combatant.maxHp, Math.floor(hp)));
    await this.firebaseService.update(
      `${this.roomPath}/combatants/${combatantId}`,
      withTimestamp({
        currentHp,
        status: COMBATANT_STATUS.ALIVE,
        deathSaves: null,
      }),
    );
    if (combatant.type === COMBATANT_TYPE.PLAYER && combatant.playerName) {
      await this.characterService.updatePlayerHp(combatant.playerName, currentHp);
    }
    return true;
  }

  async addStatusEffect(
    combatantId: string,
    type: StatusEffectType,
    options: StatusEffectOptions = {},
  ): Promise<boolean> {
    const combatant = this.combatants()[combatantId];
    if (!combatant || combatant.status === COMBATANT_STATUS.DEAD) return false;
    const currentEffects = combatant.activeEffects ?? [];
    if (currentEffects.some((effect) => effect.type === type)) return false;

    const definition = getStatusEffectDefinition(type);
    const damagePerTrigger = Math.max(0, Math.floor(options.damagePerTrigger ?? 0));
    const durationTriggers = Math.max(0, Math.floor(options.durationTriggers ?? 0));
    const hasTurnBehavior = damagePerTrigger > 0 || durationTriggers > 0;
    const effect: ActiveStatusEffect = {
      id: `effect_${crypto.randomUUID()}`,
      type,
      appliedAt: Date.now(),
      ...(damagePerTrigger > 0 ? { damagePerTrigger } : {}),
      ...(hasTurnBehavior
        ? { trigger: options.trigger ?? STATUS_EFFECT_TRIGGER.TURN_START }
        : {}),
      ...(durationTriggers > 0 ? { remainingTriggers: durationTriggers } : {}),
    };
    const activeEffects = [...currentEffects, effect];
    await this.firebaseService.update(
      `${this.roomPath}/combatants/${combatantId}`,
      withTimestamp({ activeEffects }),
    );
    this.logAction({
      type: BATTLE_ACTION_TYPE.STATUS_CHANGE,
      targetId: combatantId,
      value: 0,
      description: `${combatant.name} gains ${definition.label}`,
      reversible: false,
    });
    return true;
  }

  async removeStatusEffect(combatantId: string, effectId: string): Promise<boolean> {
    const combatant = this.combatants()[combatantId];
    if (!combatant) return false;
    const currentEffects = combatant.activeEffects ?? [];
    const removed = currentEffects.find((effect) => effect.id === effectId);
    if (!removed) return false;

    const activeEffects = currentEffects.filter((effect) => effect.id !== effectId);
    await this.firebaseService.update(`${this.roomPath}/combatants/${combatantId}`, {
      activeEffects: activeEffects.length > 0 ? activeEffects : null,
      lastUpdated: Date.now(),
    });
    const definition = getStatusEffectDefinition(removed.type);
    this.logAction({
      type: BATTLE_ACTION_TYPE.STATUS_CHANGE,
      targetId: combatantId,
      value: 0,
      description: `${combatant.name} loses ${definition.label}`,
      reversible: false,
    });
    return true;
  }

  nextTurn(): Promise<void> {
    if (this.turnTransition) return this.turnTransition;
    this.turnTransition = this.advanceTurn().finally(() => {
      this.turnTransition = null;
    });
    return this.turnTransition;
  }

  async undoLastAction(): Promise<void> {
    const last = this.actionHistory().at(-1);
    if (!last?.reversible || last.previousValue === undefined) return;
    const combatant = this.combatants()[last.targetId];
    await this.firebaseService.update(
      `${this.roomPath}/combatants/${last.targetId}`,
      withTimestamp({
        currentHp: last.previousValue,
        ...(last.previousStatus ? { status: last.previousStatus } : {}),
        deathSaves: last.previousDeathSaves ?? null,
      }),
    );
    if (combatant?.type === COMBATANT_TYPE.PLAYER && combatant.playerName) {
      await this.characterService.updatePlayerHp(combatant.playerName, last.previousValue);
    }
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

  async finishScene(mode: SceneTransitionMode = 'preserve'): Promise<void> {
    const players = Object.values(this.playersInBattle());
    const retainedPlayers: Record<string, Combatant> = {};

    for (const player of players) {
      const rested = mode === 'long-rest' && player.status !== COMBATANT_STATUS.DEAD;
      const retained: Combatant = {
        ...player,
        initiative: 0,
        currentHp: rested ? player.maxHp : player.currentHp,
        status: rested ? COMBATANT_STATUS.ALIVE : player.status,
        lastUpdated: Date.now(),
      };
      delete retained.activeEffects;
      if (rested || retained.status === COMBATANT_STATUS.ALIVE) delete retained.deathSaves;
      retainedPlayers[player.id] = retained;
    }

    const previousOrder = this.initiativeOrder();
    const orderedPlayerIds = [
      ...previousOrder.filter((id) => retainedPlayers[id] !== undefined),
      ...Object.keys(retainedPlayers).filter((id) => !previousOrder.includes(id)),
    ];
    const nextRoom: BattleRoom = {
      status: BATTLE_STATUS.PREPARATION,
      currentRound: 1,
      currentTurnIndex: 0,
      combatants: retainedPlayers,
      initiativeOrder: orderedPlayerIds,
      lastUpdated: Date.now(),
    };

    await this.firebaseService.set(this.roomPath, nextRoom);
    if (mode === 'long-rest') {
      for (const player of players) {
        if (player.status === COMBATANT_STATUS.DEAD || !player.playerName) continue;
        await this.characterService.completeLongRest(player.playerName, player.maxHp);
      }
    }
    this.actionHistory.set([]);
  }

  private async advanceTurn(): Promise<void> {
    const room = this.room();
    if (!room || room.status !== BATTLE_STATUS.BATTLE || room.initiativeOrder.length === 0) {
      return;
    }

    const combatants = { ...room.combatants };
    const updates: Record<string, unknown> = {};
    const changedPlayerHp = new Map<string, number>();
    const currentId = room.initiativeOrder[room.currentTurnIndex];
    const current = currentId ? combatants[currentId] : undefined;
    if (current && current.status !== COMBATANT_STATUS.DEAD) {
      const processed = this.processTurnEffects(current, STATUS_EFFECT_TRIGGER.TURN_END);
      if (processed.changed) {
        combatants[current.id] = processed.combatant;
        updates[`combatants/${current.id}`] = processed.combatant;
        this.trackChangedPlayerHp(current, processed.combatant, changedPlayerHp);
      }
    }

    let nextIndex: number | null = null;
    let nextRound = room.currentRound;
    const orderLength = room.initiativeOrder.length;
    for (let offset = 1; offset <= orderLength; offset += 1) {
      const absoluteIndex = room.currentTurnIndex + offset;
      const candidateIndex = absoluteIndex % orderLength;
      const candidateId = room.initiativeOrder[candidateIndex];
      const candidate = combatants[candidateId];
      if (!candidate || candidate.status === COMBATANT_STATUS.DEAD) continue;

      const processed = this.processTurnEffects(candidate, STATUS_EFFECT_TRIGGER.TURN_START);
      if (processed.changed) {
        combatants[candidate.id] = processed.combatant;
        updates[`combatants/${candidate.id}`] = processed.combatant;
        this.trackChangedPlayerHp(candidate, processed.combatant, changedPlayerHp);
      }
      if (this.canTakeTurn(processed.combatant)) {
        nextIndex = candidateIndex;
        nextRound = room.currentRound + Math.floor(absoluteIndex / orderLength);
        break;
      }
    }

    if (nextIndex === null) {
      if (Object.keys(updates).length === 0) return;
    } else {
      updates['currentTurnIndex'] = nextIndex;
      updates['currentRound'] = nextRound;
    }
    updates['lastUpdated'] = Date.now();
    await this.firebaseService.update(this.roomPath, updates);

    for (const [playerName, hp] of changedPlayerHp) {
      await this.characterService.updatePlayerHp(playerName, hp);
    }
  }

  private processTurnEffects(
    combatant: Combatant,
    trigger: StatusEffectTrigger,
  ): ProcessedTurnEffects {
    const effects = combatant.activeEffects ?? [];
    if (effects.length === 0) return { combatant, changed: false };

    let updated = combatant;
    let changed = false;
    const activeEffects: ActiveStatusEffect[] = [];
    for (const effect of effects) {
      const shouldProcess =
        effect.trigger === trigger &&
        ((effect.damagePerTrigger ?? 0) > 0 || effect.remainingTriggers !== undefined);
      if (!shouldProcess) {
        activeEffects.push(effect);
        continue;
      }

      changed = true;
      if ((effect.damagePerTrigger ?? 0) > 0 && updated.status !== COMBATANT_STATUS.DEAD) {
        updated = this.applyDamageToCombatant(updated, effect.damagePerTrigger ?? 0);
      }
      if (effect.remainingTriggers === undefined || effect.remainingTriggers > 1) {
        activeEffects.push(
          effect.remainingTriggers === undefined
            ? effect
            : { ...effect, remainingTriggers: effect.remainingTriggers - 1 },
        );
      }
    }

    const processed: Combatant = {
      ...updated,
      lastUpdated: Date.now(),
    };
    if (activeEffects.length > 0) processed.activeEffects = activeEffects;
    else delete processed.activeEffects;
    return { combatant: processed, changed };
  }

  private applyDamageToCombatant(combatant: Combatant, damage: number): Combatant {
    if (damage <= 0 || combatant.status === COMBATANT_STATUS.DEAD) return combatant;

    if (
      combatant.type === COMBATANT_TYPE.PLAYER &&
      (combatant.currentHp === 0 ||
        combatant.status === COMBATANT_STATUS.DOWNED ||
        combatant.status === COMBATANT_STATUS.STABLE)
    ) {
      const deathSaves =
        combatant.status === COMBATANT_STATUS.STABLE
          ? { successes: 0, failures: 1 }
          : {
              successes: combatant.deathSaves?.successes ?? 0,
              failures: Math.min(3, (combatant.deathSaves?.failures ?? 0) + 1),
            };
      return {
        ...combatant,
        currentHp: 0,
        status:
          deathSaves.failures >= 3 ? COMBATANT_STATUS.DEAD : COMBATANT_STATUS.DOWNED,
        deathSaves,
      };
    }

    const currentHp = this.damageCalc.applyDamage(combatant.currentHp, damage);
    if (currentHp > 0) return { ...combatant, currentHp };
    if (combatant.type === COMBATANT_TYPE.ENEMY) {
      return { ...combatant, currentHp: 0, status: COMBATANT_STATUS.DEAD };
    }
    return {
      ...combatant,
      currentHp: 0,
      status: COMBATANT_STATUS.DOWNED,
      deathSaves: { successes: 0, failures: 0 },
    };
  }

  private canTakeTurn(combatant: Combatant): boolean {
    return (
      combatant.status === COMBATANT_STATUS.ALIVE ||
      (combatant.type === COMBATANT_TYPE.PLAYER &&
        combatant.status === COMBATANT_STATUS.DOWNED)
    );
  }

  private trackChangedPlayerHp(
    before: Combatant,
    after: Combatant,
    changedPlayerHp: Map<string, number>,
  ): void {
    if (
      before.currentHp !== after.currentHp &&
      after.type === COMBATANT_TYPE.PLAYER &&
      after.playerName
    ) {
      changedPlayerHp.set(after.playerName, after.currentHp);
    }
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
