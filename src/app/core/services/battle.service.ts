import { Injectable, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { tap } from 'rxjs';
import { FirebaseService } from './firebase.service';
import { InitiativeService } from './initiative.service';
import { DamageCalculationService } from './damage-calculation.service';
import {
  BattleAction,
  BattleRoom,
  BattleUndoState,
  SceneCreatureStack,
  SceneTransitionMode,
} from '../models';
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
  history: [],
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

  private readonly room = toSignal(
    this.firebaseService.subscribe<BattleRoom>(this.roomPath).pipe(
      tap((room) => this.actionHistory.set(room?.history ?? [])),
    ),
    { initialValue: null },
  );

  // --- Основные сигналы ---
  readonly battleStatus = computed(() => this.room()?.status ?? BATTLE_STATUS.PREPARATION);
  readonly combatants = computed(() => this.room()?.combatants ?? {});
  readonly initiativeOrder = computed(() => this.room()?.initiativeOrder ?? []);
  readonly currentRound = computed(() => this.room()?.currentRound ?? 1);
  readonly currentTurnIndex = computed(() => this.room()?.currentTurnIndex ?? 0);
  readonly history = this.actionHistory.asReadonly();

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

  readonly canUndo = computed(() => this.history().some((entry) => entry.reversible));

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
      temporaryHp: player.temporaryHp ?? 0,
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
    const history = this.recordAction({
      type: BATTLE_ACTION_TYPE.DAMAGE,
      targetId: combatantId,
      value: damage,
      description: `${c.name}: −${damage} HP`,
      undoState: { combatants: { [combatantId]: c } },
    });
    await this.firebaseService.update(this.roomPath, {
      [`combatants/${combatantId}/currentHp`]: damaged.currentHp,
      [`combatants/${combatantId}/temporaryHp`]: damaged.temporaryHp ?? 0,
      [`combatants/${combatantId}/status`]: damaged.status,
      [`combatants/${combatantId}/deathSaves`]: damaged.deathSaves ?? null,
      [`combatants/${combatantId}/lastUpdated`]: Date.now(),
      history,
      lastUpdated: Date.now(),
    });

    if (c.type === COMBATANT_TYPE.PLAYER && c.playerName) {
      await this.characterService.updatePlayerHealth(
        c.playerName,
        damaged.currentHp,
        damaged.temporaryHp ?? 0,
      );
    }
  }

  async setCurrentTurn(combatantId: string): Promise<boolean> {
    const index = this.initiativeOrder().indexOf(combatantId);
    if (index < 0) return false;
    const history = this.recordAction({
      type: BATTLE_ACTION_TYPE.INITIATIVE,
      targetId: combatantId,
      value: index,
      description: `Текущий ход: ${this.combatants()[combatantId]?.name ?? combatantId}`,
      undoState: { currentTurnIndex: this.currentTurnIndex() },
    });
    await this.firebaseService.update(
      this.roomPath,
      withTimestamp({ currentTurnIndex: index, history }),
    );
    return true;
  }

  async moveCombatant(combatantId: string, direction: -1 | 1): Promise<boolean> {
    const order = [...this.initiativeOrder()];
    const index = order.indexOf(combatantId);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= order.length) return false;
    [order[index], order[nextIndex]] = [order[nextIndex], order[index]];
    const history = this.recordAction({
      type: BATTLE_ACTION_TYPE.INITIATIVE,
      targetId: combatantId,
      value: direction,
      description: `Порядок инициативы изменён`,
      undoState: {
        initiativeOrder: this.initiativeOrder(),
        currentTurnIndex: this.currentTurnIndex(),
      },
    });
    const currentId = this.initiativeOrder()[this.currentTurnIndex()];
    await this.firebaseService.update(
      this.roomPath,
      withTimestamp({
        initiativeOrder: order,
        currentTurnIndex: Math.max(0, order.indexOf(currentId)),
        history,
      }),
    );
    return true;
  }

  async damageAll(damage: number): Promise<void> {
    const targets = this.aliveEnemies();
    if (targets.length === 0) return;
    const now = Date.now();
    const updates: Record<string, unknown> = {};
    const before: Record<string, Combatant> = {};
    for (const enemy of targets) {
      before[enemy.id] = enemy;
      const damaged = this.applyDamageToCombatant(enemy, damage);
      updates[`combatants/${enemy.id}/currentHp`] = damaged.currentHp;
      updates[`combatants/${enemy.id}/temporaryHp`] = damaged.temporaryHp ?? 0;
      updates[`combatants/${enemy.id}/status`] = damaged.status;
      updates[`combatants/${enemy.id}/lastUpdated`] = now;
    }
    updates['history'] = this.recordAction({
      type: BATTLE_ACTION_TYPE.DAMAGE,
      targetId: 'all',
      value: damage,
      description: `Массовый урон: ${damage}`,
      undoState: { combatants: before },
    });
    updates['lastUpdated'] = now;
    await this.firebaseService.update(this.roomPath, updates);
  }

  async damageMany(combatantIds: readonly string[], damage: number): Promise<void> {
    const targets = [...new Set(combatantIds)]
      .map((id) => this.combatants()[id])
      .filter((combatant): combatant is Combatant =>
        !!combatant && combatant.status !== COMBATANT_STATUS.DEAD,
      );
    if (targets.length === 0 || damage <= 0) return;
    const now = Date.now();
    const updates: Record<string, unknown> = {};
    const before: Record<string, Combatant> = {};
    const changedPlayers: Combatant[] = [];
    for (const target of targets) {
      before[target.id] = target;
      const damaged = this.applyDamageToCombatant(target, damage);
      updates[`combatants/${target.id}`] = { ...damaged, lastUpdated: now };
      if (damaged.type === COMBATANT_TYPE.PLAYER && damaged.playerName) changedPlayers.push(damaged);
    }
    updates['history'] = this.recordAction({
      type: BATTLE_ACTION_TYPE.DAMAGE,
      targetId: targets.map((target) => target.id).join(','),
      value: damage,
      description: `${targets.length} цел.: −${damage} HP`,
      undoState: { combatants: before },
    });
    updates['lastUpdated'] = now;
    await this.firebaseService.update(this.roomPath, updates);
    for (const player of changedPlayers) {
      await this.characterService.updatePlayerHealth(
        player.playerName!,
        player.currentHp,
        player.temporaryHp ?? 0,
      );
    }
  }

  async heal(combatantId: string, amount: number): Promise<void> {
    const c = this.combatants()[combatantId];
    if (!c || c.status === COMBATANT_STATUS.DEAD || amount <= 0) return;
    const newHp = this.damageCalc.applyHeal(c.currentHp, amount, c.maxHp);
    const status = newHp > 0 ? COMBATANT_STATUS.ALIVE : c.status;
    const history = this.recordAction({
      type: BATTLE_ACTION_TYPE.HEAL,
      targetId: combatantId,
      value: amount,
      description: `${c.name}: +${amount} HP`,
      undoState: { combatants: { [combatantId]: c } },
    });
    await this.firebaseService.update(this.roomPath, {
      [`combatants/${combatantId}/currentHp`]: newHp,
      [`combatants/${combatantId}/status`]: status,
      [`combatants/${combatantId}/deathSaves`]: newHp > 0 ? null : c.deathSaves,
      [`combatants/${combatantId}/lastUpdated`]: Date.now(),
      history,
      lastUpdated: Date.now(),
    });
    if (c.type === COMBATANT_TYPE.PLAYER && c.playerName) {
      await this.characterService.updatePlayerHealth(c.playerName, newHp, c.temporaryHp ?? 0);
    }
  }

  async healMany(combatantIds: readonly string[], amount: number): Promise<void> {
    const targets = [...new Set(combatantIds)]
      .map((id) => this.combatants()[id])
      .filter((combatant): combatant is Combatant =>
        !!combatant && combatant.status !== COMBATANT_STATUS.DEAD,
      );
    if (targets.length === 0 || amount <= 0) return;
    const now = Date.now();
    const updates: Record<string, unknown> = {};
    const before: Record<string, Combatant> = {};
    const changedPlayers: Combatant[] = [];
    for (const target of targets) {
      before[target.id] = target;
      const currentHp = this.damageCalc.applyHeal(target.currentHp, amount, target.maxHp);
      const healed: Combatant = {
        ...target,
        currentHp,
        status: currentHp > 0 ? COMBATANT_STATUS.ALIVE : target.status,
      };
      if (currentHp > 0) delete healed.deathSaves;
      updates[`combatants/${target.id}`] = { ...healed, lastUpdated: now };
      if (healed.type === COMBATANT_TYPE.PLAYER && healed.playerName) changedPlayers.push(healed);
    }
    updates['history'] = this.recordAction({
      type: BATTLE_ACTION_TYPE.HEAL,
      targetId: targets.map((target) => target.id).join(','),
      value: amount,
      description: `${targets.length} цел.: +${amount} HP`,
      undoState: { combatants: before },
    });
    updates['lastUpdated'] = now;
    await this.firebaseService.update(this.roomPath, updates);
    for (const player of changedPlayers) {
      await this.characterService.updatePlayerHealth(
        player.playerName!,
        player.currentHp,
        player.temporaryHp ?? 0,
      );
    }
  }

  async setTemporaryHp(combatantId: string, amount: number): Promise<void> {
    const combatant = this.combatants()[combatantId];
    if (!combatant || combatant.status === COMBATANT_STATUS.DEAD) return;
    const temporaryHp = Math.max(0, Math.floor(amount));
    const history = this.recordAction({
      type: BATTLE_ACTION_TYPE.TEMP_HP,
      targetId: combatantId,
      value: temporaryHp,
      description: `${combatant.name}: временные HP ${temporaryHp}`,
      undoState: { combatants: { [combatantId]: combatant } },
    });
    await this.firebaseService.update(this.roomPath, {
      [`combatants/${combatantId}/temporaryHp`]: temporaryHp,
      [`combatants/${combatantId}/lastUpdated`]: Date.now(),
      history,
      lastUpdated: Date.now(),
    });
    if (combatant.type === COMBATANT_TYPE.PLAYER && combatant.playerName) {
      await this.characterService.updatePlayerHealth(
        combatant.playerName,
        combatant.currentHp,
        temporaryHp,
      );
    }
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

    const history = this.recordAction({
      type: BATTLE_ACTION_TYPE.STATUS_CHANGE,
      targetId: combatantId,
      value: 0,
      description: `${combatant.name}: спасбросок от смерти`,
      undoState: { combatants: { [combatantId]: combatant } },
    });
    await this.firebaseService.update(this.roomPath, {
      [`combatants/${combatantId}/currentHp`]: currentHp,
      [`combatants/${combatantId}/status`]: status,
      [`combatants/${combatantId}/deathSaves`]:
        status === COMBATANT_STATUS.ALIVE ? null : deathSaves,
      [`combatants/${combatantId}/lastUpdated`]: Date.now(),
      history,
      lastUpdated: Date.now(),
    });
    if (currentHp > 0 && combatant.playerName) {
      await this.characterService.updatePlayerHealth(
        combatant.playerName,
        currentHp,
        combatant.temporaryHp ?? 0,
      );
    }
    return true;
  }

  async revive(combatantId: string, hp = 1): Promise<boolean> {
    const combatant = this.combatants()[combatantId];
    if (!combatant || combatant.status === COMBATANT_STATUS.ALIVE) return false;

    const currentHp = Math.max(1, Math.min(combatant.maxHp, Math.floor(hp)));
    const history = this.recordAction({
      type: BATTLE_ACTION_TYPE.HEAL,
      targetId: combatantId,
      value: currentHp,
      description: `${combatant.name}: возвращён в бой`,
      undoState: { combatants: { [combatantId]: combatant } },
    });
    await this.firebaseService.update(this.roomPath, {
      [`combatants/${combatantId}/currentHp`]: currentHp,
      [`combatants/${combatantId}/status`]: COMBATANT_STATUS.ALIVE,
      [`combatants/${combatantId}/deathSaves`]: null,
      [`combatants/${combatantId}/lastUpdated`]: Date.now(),
      history,
      lastUpdated: Date.now(),
    });
    if (combatant.type === COMBATANT_TYPE.PLAYER && combatant.playerName) {
      await this.characterService.updatePlayerHealth(
        combatant.playerName,
        currentHp,
        combatant.temporaryHp ?? 0,
      );
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
      ...(options.source?.trim() ? { source: options.source.trim() } : {}),
      ...(options.concentrationSourceId
        ? { concentrationSourceId: options.concentrationSourceId }
        : {}),
      ...(options.saveAbility?.trim() ? { saveAbility: options.saveAbility.trim() } : {}),
      ...((options.saveDc ?? 0) > 0 ? { saveDc: Math.floor(options.saveDc!) } : {}),
      ...(options.notes?.trim() ? { notes: options.notes.trim() } : {}),
    };
    const before: Record<string, Combatant> = {};
    const updates: Record<string, unknown> = {};
    if (options.concentrationSourceId) {
      for (const candidate of Object.values(this.combatants())) {
        const effects = candidate.activeEffects ?? [];
        const filtered = effects.filter(
          (active) => active.concentrationSourceId !== options.concentrationSourceId,
        );
        if (filtered.length === effects.length) continue;
        before[candidate.id] = candidate;
        updates[`combatants/${candidate.id}/activeEffects`] =
          filtered.length > 0 ? filtered : null;
        updates[`combatants/${candidate.id}/lastUpdated`] = Date.now();
      }
    }
    before[combatantId] ??= combatant;
    const targetEffects = options.concentrationSourceId
      ? currentEffects.filter(
          (active) => active.concentrationSourceId !== options.concentrationSourceId,
        )
      : currentEffects;
    updates[`combatants/${combatantId}/activeEffects`] = [...targetEffects, effect];
    updates[`combatants/${combatantId}/lastUpdated`] = Date.now();
    updates['history'] = this.recordAction({
      type: BATTLE_ACTION_TYPE.STATUS_CHANGE,
      targetId: combatantId,
      value: 0,
      description: `${combatant.name}: ${definition.label}`,
      undoState: { combatants: before },
    });
    updates['lastUpdated'] = Date.now();
    await this.firebaseService.update(this.roomPath, updates);
    return true;
  }

  async removeStatusEffect(combatantId: string, effectId: string): Promise<boolean> {
    const combatant = this.combatants()[combatantId];
    if (!combatant) return false;
    const currentEffects = combatant.activeEffects ?? [];
    const removed = currentEffects.find((effect) => effect.id === effectId);
    if (!removed) return false;

    const before: Record<string, Combatant> = {};
    const updates: Record<string, unknown> = {};
    for (const candidate of Object.values(this.combatants())) {
      const effects = candidate.activeEffects ?? [];
      const filtered = removed.concentrationSourceId
        ? effects.filter(
            (effect) => effect.concentrationSourceId !== removed.concentrationSourceId,
          )
        : candidate.id === combatantId
          ? effects.filter((effect) => effect.id !== effectId)
          : effects;
      if (filtered.length === effects.length) continue;
      before[candidate.id] = candidate;
      updates[`combatants/${candidate.id}/activeEffects`] = filtered.length > 0 ? filtered : null;
      updates[`combatants/${candidate.id}/lastUpdated`] = Date.now();
    }
    const definition = getStatusEffectDefinition(removed.type);
    updates['history'] = this.recordAction({
      type: BATTLE_ACTION_TYPE.STATUS_CHANGE,
      targetId: combatantId,
      value: 0,
      description: `${combatant.name}: снят ${definition.label}`,
      undoState: { combatants: before },
    });
    updates['lastUpdated'] = Date.now();
    await this.firebaseService.update(this.roomPath, updates);
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
    const currentHistory = this.currentHistory();
    const last = currentHistory.at(-1);
    if (!last?.reversible) return;
    const remaining = currentHistory.slice(0, -1);

    if (last.undoState) {
      const updates: Record<string, unknown> = {
        history: remaining.length > 0 ? remaining : null,
        lastUpdated: Date.now(),
      };
      for (const [combatantId, combatant] of Object.entries(
        last.undoState.combatants ?? {},
      )) {
        updates[`combatants/${combatantId}`] = combatant;
      }
      if (last.undoState.initiativeOrder) {
        updates['initiativeOrder'] = last.undoState.initiativeOrder;
      }
      if (last.undoState.currentRound !== undefined) {
        updates['currentRound'] = last.undoState.currentRound;
      }
      if (last.undoState.currentTurnIndex !== undefined) {
        updates['currentTurnIndex'] = last.undoState.currentTurnIndex;
      }
      if (last.undoState.status !== undefined) updates['status'] = last.undoState.status;
      await this.firebaseService.update(this.roomPath, updates);
      for (const combatant of Object.values(last.undoState.combatants ?? {})) {
        if (combatant?.type === COMBATANT_TYPE.PLAYER && combatant.playerName) {
          await this.characterService.updatePlayerHealth(
            combatant.playerName,
            combatant.currentHp,
            combatant.temporaryHp ?? 0,
          );
        }
      }
      this.actionHistory.set(remaining);
      return;
    }

    // Compatibility for actions recorded by an older client.
    if (last.previousValue === undefined) return;
    const combatant = this.combatants()[last.targetId];
    await this.firebaseService.update(`${this.roomPath}/combatants/${last.targetId}`, {
      currentHp: last.previousValue,
      ...(last.previousStatus ? { status: last.previousStatus } : {}),
      deathSaves: last.previousDeathSaves ?? null,
      lastUpdated: Date.now(),
    });
    if (combatant?.type === COMBATANT_TYPE.PLAYER && combatant.playerName) {
      await this.characterService.updatePlayerHealth(
        combatant.playerName,
        last.previousValue,
        combatant.temporaryHp ?? 0,
      );
    }
    this.actionHistory.set(remaining);
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
        temporaryHp: rested ? 0 : (player.temporaryHp ?? 0),
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
    if (mode === 'short-rest') {
      for (const player of players) {
        if (player.status === COMBATANT_STATUS.DEAD || !player.playerName) continue;
        await this.characterService.completeShortRest(player.playerName);
      }
    } else if (mode === 'long-rest') {
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
    updates['history'] = this.recordAction({
      type: BATTLE_ACTION_TYPE.TURN,
      targetId: nextIndex === null ? '' : room.initiativeOrder[nextIndex],
      value: nextRound,
      description:
        nextIndex === null
          ? 'Эффекты хода обработаны'
          : `Ход: ${combatants[room.initiativeOrder[nextIndex]]?.name ?? 'участник'}`,
      undoState: {
        combatants: room.combatants,
        currentRound: room.currentRound,
        currentTurnIndex: room.currentTurnIndex,
      },
    });
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

    const temporaryHp = Math.max(0, combatant.temporaryHp ?? 0);
    const absorbed = Math.min(temporaryHp, damage);
    const remainingDamage = damage - absorbed;
    const afterTemporaryHp = temporaryHp - absorbed;
    if (remainingDamage <= 0) {
      return { ...combatant, temporaryHp: afterTemporaryHp };
    }

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
        temporaryHp: afterTemporaryHp,
        currentHp: 0,
        status:
          deathSaves.failures >= 3 ? COMBATANT_STATUS.DEAD : COMBATANT_STATUS.DOWNED,
        deathSaves,
      };
    }

    const currentHp = this.damageCalc.applyDamage(combatant.currentHp, remainingDamage);
    if (currentHp > 0) return { ...combatant, currentHp, temporaryHp: afterTemporaryHp };
    if (combatant.type === COMBATANT_TYPE.ENEMY) {
      return {
        ...combatant,
        currentHp: 0,
        temporaryHp: afterTemporaryHp,
        status: COMBATANT_STATUS.DEAD,
      };
    }
    return {
      ...combatant,
      currentHp: 0,
      temporaryHp: afterTemporaryHp,
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

  private currentHistory(): BattleAction[] {
    return this.actionHistory();
  }

  private recordAction(
    action: Omit<BattleAction, 'id' | 'timestamp' | 'reversible'> & {
      undoState: BattleUndoState;
    },
  ): BattleAction[] {
    const entry: BattleAction = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      reversible: true,
      ...action,
    };
    const history = [...this.currentHistory().slice(-49), entry];
    this.actionHistory.set(history);
    return history;
  }
}
