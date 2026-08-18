import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DatePipe, KeyValuePipe, UpperCasePipe } from '@angular/common';
import { BattleService } from '../../core/services/battle.service';
import { CharacterService } from '../../core/services/character.service';
import { InventoryService } from '../../core/services/inventory.service';
import { LoggerService } from '../../core/services/logger.service';
import { Combatant, SpellData } from '../../core/models/combatant.model';
import { BATTLE_STATUS } from '../../core/constants/battle-status.constants';
import {
  COMBATANT_STATUS,
  COMBATANT_TYPE,
  DEATH_SAVE_RESULT,
  DeathSaveResult,
} from '../../core/constants/combatant.constants';
import { ItemRarity, ITEM_RARITY } from '../../core/constants/item-rarity.constants';
import {
  getStatusEffectDefinition,
  STATUS_EFFECT_DEFINITIONS,
  STATUS_EFFECT_TRIGGER,
  STATUS_EFFECT_TYPE,
  StatusEffectTrigger,
  StatusEffectType,
} from '../../core/constants/status-effect.constants';
import { SceneTransitionMode } from '../../core/models';
import { DmItemLibraryComponent } from './item-library/dm-item-library.component';
import { DmSceneLibraryComponent } from './scene-library/dm-scene-library.component';
import { DmCharacterResourcesComponent } from './character-resources/dm-character-resources.component';
import { DmOpen5eImportComponent } from './open5e-import/dm-open5e-import.component';

@Component({
  selector: 'app-dm-control',
  standalone: true,
  imports: [
    DatePipe,
    UpperCasePipe,
    KeyValuePipe,
    DmSceneLibraryComponent,
    DmItemLibraryComponent,
    DmCharacterResourcesComponent,
    DmOpen5eImportComponent,
  ],
  templateUrl: './dm-control.component.html',
  styleUrl: './dm-control.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DmControlComponent {
  // --- Внедрённые сервисы ---
  private readonly battleService = inject(BattleService);
  private readonly characterService = inject(CharacterService);
  private readonly inventoryService = inject(InventoryService);
  private readonly logger = inject(LoggerService);

  // --- Константы для шаблона ---
  readonly BATTLE_STATUS = BATTLE_STATUS;
  readonly COMBATANT_STATUS = COMBATANT_STATUS;
  readonly COMBATANT_TYPE = COMBATANT_TYPE;
  readonly DEATH_SAVE_RESULT = DEATH_SAVE_RESULT;

  readonly activePanel = signal<'library' | 'scenes' | 'battle' | 'rewards'>('scenes');

  // --- Панель изменения HP ---
  readonly hpOperation = signal<'damage' | 'heal' | 'temporary'>('damage');
  readonly targetType = signal<'enemies' | 'players' | 'all' | 'selected'>('enemies');
  readonly damageTargetId = signal<string | null>(null);
  readonly damageAmount = signal(0);
  readonly damageMode = signal<'single' | 'all'>('single');
  readonly selectedCombatantIds = signal<string[]>([]);

  // --- Панель статус-эффектов ---
  readonly STATUS_EFFECT_DEFINITIONS = STATUS_EFFECT_DEFINITIONS;
  readonly selectedStatusTargetId = signal<string | null>(null);
  readonly selectedStatusEffect = signal<StatusEffectType>(STATUS_EFFECT_TYPE.POISONED);
  readonly applyingStatus = signal(false);
  readonly removingEffectId = signal<string | null>(null);
  readonly statusError = signal<string | null>(null);
  readonly statusDamage = signal(0);
  readonly statusDuration = signal(0);
  readonly statusTrigger = signal<StatusEffectTrigger>(STATUS_EFFECT_TRIGGER.TURN_START);
  readonly statusSource = signal('');
  readonly statusConcentrationSourceId = signal('');
  readonly statusSaveAbility = signal('');
  readonly statusSaveDc = signal(0);
  readonly statusNotes = signal('');
  readonly advancingTurn = signal(false);
  readonly transitioningScene = signal(false);

  // --- Панель выдачи предметов ---
  readonly selectedPlayerIdForItem = signal<string | null>(null);
  readonly itemName = signal('');
  readonly itemDescription = signal('');
  readonly itemQuantity = signal(1);
  readonly itemRarity = signal<ItemRarity>(ITEM_RARITY.COMMON);

  // --- Панель выдачи заклинаний ---
  readonly selectedPlayerIdForSpell = signal<string | null>(null);
  readonly spellName = signal('');
  readonly spellLevel = signal(0);
  readonly spellSchool = signal('');
  readonly spellDescription = signal('');
  readonly spellDamageFormula = signal('');
  readonly spellDamageType = signal('');
  readonly isSpellCantrip = computed(() => this.spellLevel() === 0);

  // --- UI подготовки/инициативы ---
  readonly showInitiativeRolls = signal(false);
  readonly initiativeRolls = signal<Record<string, number>>({});
  readonly playersLoading = signal(false);
  readonly playerSyncMessage = signal<string | null>(null);
  readonly playerSyncError = signal<string | null>(null);

  // --- Данные из BattleService ---
  readonly battleStatus = this.battleService.battleStatus;
  readonly aliveEnemies = this.battleService.aliveEnemies;
  readonly sortedByInitiative = this.battleService.sortedCombatants;
  readonly currentRound = this.battleService.currentRound;
  readonly currentEnemy = this.battleService.currentCombatant;
  readonly playersInBattle = this.battleService.playersInBattle;
  readonly battleHistory = this.battleService.history;
  readonly canUndo = this.battleService.canUndo;

  // --- Производные значения ---
  readonly allCombatants = computed(() => Object.values(this.battleService.combatants()));
  readonly enemiesList = computed(() => Object.values(this.battleService.enemies()));

  readonly canApplyDamage = computed(() => {
    if (this.targetType() === 'all') {
      return this.damageAmount() > 0 && this.aliveEnemies().length > 0;
    }
    if (this.targetType() === 'selected') {
      return this.damageAmount() > 0 && this.selectedCombatantIds().length > 0;
    }
    return this.damageAmount() > 0 && !!this.damageTargetId();
  });

  readonly canApplyHealing = computed(() => {
    if (this.targetType() === 'selected') {
      return this.damageAmount() > 0 && this.selectedCombatantIds().length > 0;
    }
    return this.targetType() !== 'all' && this.damageAmount() > 0 && !!this.damageTargetId();
  });

  readonly canApplyTemporaryHp = computed(
    () => this.damageAmount() >= 0 && !!this.damageTargetId() && this.targetType() !== 'all',
  );

  readonly selectedHpTarget = computed(() => {
    const targetId = this.damageTargetId();
    return targetId ? this.battleService.combatants()[targetId] ?? null : null;
  });

  readonly maxHealingAmount = computed<number | null>(() => {
    const target = this.selectedHpTarget();
    return target ? Math.max(0, target.maxHp - target.currentHp) : null;
  });

  readonly selectedStatusTarget = computed(() => {
    const targetId = this.selectedStatusTargetId();
    return targetId ? this.battleService.combatants()[targetId] ?? null : null;
  });

  readonly canApplyStatus = computed(() => {
    const target = this.selectedStatusTarget();
    return (
      !!target &&
      target.status !== COMBATANT_STATUS.DEAD &&
      !(target.activeEffects ?? []).some((effect) => effect.type === this.selectedStatusEffect())
    );
  });

  readonly selectedStatusDefinition = computed(() =>
    getStatusEffectDefinition(this.selectedStatusEffect()),
  );

  readonly hasTurnStatusConfig = computed(
    () => this.statusDamage() > 0 || this.statusDuration() > 0,
  );

  readonly combatantsWithEffects = computed(() =>
    this.sortedByInitiative().filter((combatant) => (combatant.activeEffects?.length ?? 0) > 0),
  );

  readonly availableTargets = computed(() => {
    const type = this.targetType();
    if (type === 'enemies') {
      return this.aliveEnemies();
    } else if (type === 'players') {
      const playersObj = this.playersInBattle();
      return Object.values(playersObj).filter((p) => p.status !== COMBATANT_STATUS.DEAD);
    } else if (type === 'selected') {
      return this.sortedByInitiative().filter(
        (combatant) => combatant.status !== COMBATANT_STATUS.DEAD,
      );
    } else {
      return this.aliveEnemies();
    }
  });

  ngOnInit(): void {
    void this.loadPlayersToBattleSilent();
  }

  private async loadPlayersToBattleSilent(showFeedback = false): Promise<void> {
    if (this.playersLoading()) return;
    this.playersLoading.set(true);
    this.playerSyncError.set(null);
    if (showFeedback) this.playerSyncMessage.set(null);
    try {
      const players = await this.characterService.getAllPlayers();
      await this.battleService.syncPlayersToBattle(players);
      if (showFeedback) {
        this.playerSyncMessage.set(
          players.length > 0
            ? `Список игроков обновлён: ${players.length}.`
            : 'В базе пока нет сохранённых игроков.',
        );
      }
    } catch (error) {
      this.logger.error('DmControlComponent.loadPlayersToBattle', error);
      this.playerSyncError.set('Не удалось загрузить игроков из базы. Попробуйте обновить список.');
    } finally {
      this.playersLoading.set(false);
    }
  }

  removePlayerFromBattle(playerId: string): void {
    const playerName = playerId.replace('player_', '');
    this.battleService
      .removePlayerFromBattle(playerName)
      .catch((error: unknown) =>
        this.logger.error('DmControlComponent.removePlayerFromBattle', error),
      );
  }

  removeCombatant(combatant: Combatant): void {
    if (combatant.type === COMBATANT_TYPE.PLAYER) {
      this.removePlayerFromBattle(combatant.id);
      return;
    }
    this.removeEnemy(combatant.id);
  }

  giveItem(): void {
    const playerId = this.selectedPlayerIdForItem();
    const name = this.itemName().trim();
    const quantity = this.itemQuantity();
    const description = this.itemDescription().trim();
    const rarity = this.itemRarity();
    if (!playerId || !name || quantity < 1) return;
    const playerName = playerId.replace('player_', '');
    this.inventoryService
      .giveItem(playerName, { name, quantity, description, rarity })
      .then(() => {
        this.itemName.set('');
        this.itemDescription.set('');
        this.itemQuantity.set(1);
        this.itemRarity.set(ITEM_RARITY.COMMON);
        this.selectedPlayerIdForItem.set(null);
      })
      .catch((error: unknown) => this.logger.error('DmControlComponent.giveItem', error));
  }

  onSelectPlayerForSpell(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.selectedPlayerIdForSpell.set(select.value || null);
  }

  onSpellLevelInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const level = Number(input.value);
    this.spellLevel.set(Math.min(9, Math.max(0, Number.isFinite(level) ? level : 0)));
  }

  giveSpell(): void {
    const playerId = this.selectedPlayerIdForSpell();
    const name = this.spellName().trim();
    const level = this.spellLevel();
    if (!playerId || !name) return;

    const playerName = playerId.replace('player_', '');
    const spell: SpellData = {
      id: `spell-${crypto.randomUUID()}`,
      name,
      level,
      school: this.spellSchool().trim(),
      description: this.spellDescription().trim(),
      damageFormula: this.spellDamageFormula().trim(),
      damageType: this.spellDamageType().trim(),
      isCantrip: level === 0,
      isPrepared: true,
    };

    this.characterService
      .updatePlayerSpells(playerName, spell)
      .then(() => this.resetSpellForm())
      .catch((error: unknown) => this.logger.error('DmControlComponent.giveSpell', error));
  }

  resetSpellForm(): void {
    this.selectedPlayerIdForSpell.set(null);
    this.spellName.set('');
    this.spellLevel.set(0);
    this.spellSchool.set('');
    this.spellDescription.set('');
    this.spellDamageFormula.set('');
    this.spellDamageType.set('');
  }

  restoreSpells(): void {
    const playerId = this.selectedPlayerIdForSpell();
    if (!playerId) return;

    const playerName = playerId.replace('player_', '');
    this.characterService
      .restorePlayerSpells(playerName)
      .catch((error: unknown) => this.logger.error('DmControlComponent.restoreSpells', error));
  }

  onDamageTargetChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    const value = select.value;
    // Если value пустая строка или "null" – считаем за null
    this.damageTargetId.set(value && value !== 'null' ? value : null);
    this.clampHealingAmount();
  }

  onSelectPlayerForItem(event: Event): void {
    const select = event.target as HTMLSelectElement;
    const value = select.value;
    this.selectedPlayerIdForItem.set(value && value !== 'null' ? value : null);
  }

  onDamageAmountInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const value = Number(input.value);
    const safeValue = value > 0 ? value : 0;
    const maximum = this.hpOperation() === 'heal' ? this.maxHealingAmount() : null;
    this.damageAmount.set(maximum === null ? safeValue : Math.min(safeValue, maximum));
  }

  onStatusTargetChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.selectedStatusTargetId.set(select.value || null);
    this.statusError.set(null);
  }

  selectStatusEffect(type: StatusEffectType): void {
    this.selectedStatusEffect.set(type);
    if (!getStatusEffectDefinition(type).damageCapable) this.statusDamage.set(0);
    this.statusError.set(null);
  }

  onStatusDamageInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const value = Number(input.value);
    this.statusDamage.set(Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0);
  }

  onStatusDurationInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const value = Number(input.value);
    this.statusDuration.set(Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0);
  }

  onStatusTriggerChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.statusTrigger.set(
      select.value === STATUS_EFFECT_TRIGGER.TURN_END
        ? STATUS_EFFECT_TRIGGER.TURN_END
        : STATUS_EFFECT_TRIGGER.TURN_START,
    );
  }

  statusEffectDefinition(type: StatusEffectType) {
    return getStatusEffectDefinition(type);
  }

  setHpOperation(operation: 'damage' | 'heal' | 'temporary'): void {
    this.hpOperation.set(operation);
    if (operation !== 'damage' && this.targetType() === 'all') {
      this.targetType.set('enemies');
    }
    if (operation === 'temporary' && this.targetType() === 'selected') {
      this.targetType.set('players');
    }
    this.resetDamagePanel();
  }

  setHpTargetType(type: 'enemies' | 'players' | 'all' | 'selected'): void {
    this.targetType.set(type);
    this.damageTargetId.set(null);
    if (type !== 'selected') this.selectedCombatantIds.set([]);
  }

  toggleHpTarget(combatantId: string, checked: boolean): void {
    this.selectedCombatantIds.update((ids) =>
      checked
        ? ids.includes(combatantId)
          ? ids
          : [...ids, combatantId]
        : ids.filter((id) => id !== combatantId),
    );
  }

  onItemQuantityInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const value = Number(input.value);
    this.itemQuantity.set(value > 0 ? value : 1);
  }

  loadPlayersToBattle(): void {
    void this.loadPlayersToBattleSilent(true);
  }

  endBattle(): void {
    this.battleService
      .endBattle()
      .catch((error: unknown) => this.logger.error('DmControlComponent.endBattle', error));
  }

  removeEnemy(id: string): void {
    this.battleService
      .removeEnemy(id)
      .catch((error: unknown) => this.logger.error('DmControlComponent.removeEnemy', error));
  }

  onInitiativeInput(enemyId: string, event: Event): void {
    const input = event.target as HTMLInputElement;
    const value = Number(input.value);
    this.setInitiative(enemyId, value > 0 ? value : 0);
    this.battleService
      .sortInitiative()
      .catch((error: unknown) => this.logger.error('DmControlComponent.onInitiativeInput', error));
  }

  startInitiativeRolls() {
    const rolls: Record<string, number> = {};
    for (const enemy of this.enemiesList()) {
      rolls[enemy.id] = Math.floor(Math.random() * 20) + 1;
    }
    this.initiativeRolls.set(rolls);
    this.showInitiativeRolls.set(true);
  }

  setInitiative(enemyId: string, value: number): void {
    this.battleService
      .setInitiative(enemyId, value)
      .catch((error: unknown) => this.logger.error('DmControlComponent.setInitiative', error));
  }

  confirmInitiative(): void {
    this.battleService
      .rollInitiative()
      .then(() => {
        this.showInitiativeRolls.set(false);
      })
      .catch((error: unknown) => this.logger.error('DmControlComponent.confirmInitiative', error));
  }

  startBattle(): void {
    this.battleService
      .startBattle()
      .catch((error: unknown) => this.logger.error('DmControlComponent.startBattle', error));
  }

  applyDamage(): void {
    if (!this.canApplyDamage()) return;
    const amount = this.damageAmount();

    if (this.targetType() === 'all') {
      this.battleService
        .damageAll(amount)
        .then(() => this.resetDamagePanel())
        .catch((error: unknown) => this.logger.error('DmControlComponent.applyDamage', error));
      return;
    }

    if (this.targetType() === 'selected') {
      this.battleService
        .damageMany(this.selectedCombatantIds(), amount)
        .then(() => this.resetDamagePanel())
        .catch((error: unknown) => this.logger.error('DmControlComponent.applyDamage', error));
      return;
    }

    const targetId = this.damageTargetId();
    if (!targetId) return;

    this.battleService
      .takeDamage(targetId, amount)
      .then(() => this.resetDamagePanel())
      .catch((error: unknown) => this.logger.error('DmControlComponent.applyDamage', error));
  }

  applyHealing(): void {
    if (!this.canApplyHealing()) return;
    if (this.targetType() === 'selected') {
      this.battleService
        .healMany(this.selectedCombatantIds(), this.damageAmount())
        .then(() => this.resetDamagePanel())
        .catch((error: unknown) => this.logger.error('DmControlComponent.applyHealing', error));
      return;
    }
    const targetId = this.damageTargetId();
    if (!targetId) return;

    this.battleService
      .heal(targetId, this.damageAmount())
      .then(() => this.resetDamagePanel())
      .catch((error: unknown) => this.logger.error('DmControlComponent.applyHealing', error));
  }

  applyTemporaryHp(): void {
    if (!this.canApplyTemporaryHp()) return;
    const targetId = this.damageTargetId();
    if (!targetId) return;
    this.battleService
      .setTemporaryHp(targetId, this.damageAmount())
      .then(() => this.resetDamagePanel())
      .catch((error: unknown) => this.logger.error('DmControlComponent.applyTemporaryHp', error));
  }

  applyStatusEffect(): void {
    const targetId = this.selectedStatusTargetId();
    if (!targetId || !this.canApplyStatus() || this.applyingStatus()) return;

    this.applyingStatus.set(true);
    this.statusError.set(null);
    this.battleService
      .addStatusEffect(targetId, this.selectedStatusEffect(), {
        damagePerTrigger: this.statusDamage(),
        durationTriggers: this.statusDuration(),
        trigger: this.statusTrigger(),
        source: this.statusSource(),
        concentrationSourceId: this.statusConcentrationSourceId() || undefined,
        saveAbility: this.statusSaveAbility(),
        saveDc: this.statusSaveDc(),
        notes: this.statusNotes(),
      })
      .then((added) => {
        if (!added) {
          this.statusError.set('Эффект уже назначен или участник больше недоступен.');
          return;
        }
        this.statusDamage.set(0);
        this.statusDuration.set(0);
        this.statusSource.set('');
        this.statusConcentrationSourceId.set('');
        this.statusSaveAbility.set('');
        this.statusSaveDc.set(0);
        this.statusNotes.set('');
      })
      .catch((error: unknown) => {
        this.logger.error('DmControlComponent.applyStatusEffect', error);
        this.statusError.set('Не удалось назначить эффект.');
      })
      .finally(() => this.applyingStatus.set(false));
  }

  removeStatusEffect(combatantId: string, effectId: string): void {
    if (this.removingEffectId()) return;
    this.removingEffectId.set(effectId);
    this.statusError.set(null);
    this.battleService
      .removeStatusEffect(combatantId, effectId)
      .then((removed) => {
        if (!removed) this.statusError.set('Эффект уже снят или участник больше недоступен.');
      })
      .catch((error: unknown) => {
        this.logger.error('DmControlComponent.removeStatusEffect', error);
        this.statusError.set('Не удалось снять эффект.');
      })
      .finally(() => this.removingEffectId.set(null));
  }

  cancelDamage(): void {
    this.resetDamagePanel();
  }

  nextTurn(): void {
    if (this.advancingTurn()) return;
    this.advancingTurn.set(true);
    this.battleService
      .nextTurn()
      .catch((error: unknown) => this.logger.error('DmControlComponent.nextTurn', error))
      .finally(() => this.advancingTurn.set(false));
  }

  recordDeathSave(combatantId: string, result: DeathSaveResult): void {
    this.battleService
      .recordDeathSave(combatantId, result)
      .catch((error: unknown) => this.logger.error('DmControlComponent.recordDeathSave', error));
  }

  reviveCombatant(combatantId: string): void {
    this.battleService
      .revive(combatantId, 1)
      .catch((error: unknown) => this.logger.error('DmControlComponent.reviveCombatant', error));
  }

  lifeStatusLabel(combatant: Combatant): string {
    switch (combatant.status) {
      case COMBATANT_STATUS.DOWNED:
        return 'Без сознания';
      case COMBATANT_STATUS.STABLE:
        return 'Стабилен';
      case COMBATANT_STATUS.DEAD:
        return 'Погиб';
      default:
        return 'В строю';
    }
  }

  finishScene(mode: SceneTransitionMode): void {
    if (this.transitioningScene()) return;
    const message =
      mode === 'long-rest'
        ? 'Завершить сцену, убрать врагов и полностью восстановить живых игроков?'
        : mode === 'short-rest'
          ? 'Завершить сцену с коротким отдыхом? HP не изменится.'
          : 'Завершить сцену, убрать врагов и сохранить текущее HP игроков?';
    if (!confirm(message)) return;

    this.transitioningScene.set(true);
    this.battleService
      .finishScene(mode)
      .then(() => {
        this.showInitiativeRolls.set(false);
        this.activePanel.set('scenes');
      })
      .catch((error: unknown) => this.logger.error('DmControlComponent.finishScene', error))
      .finally(() => this.transitioningScene.set(false));
  }

  undoLastAction(): void {
    this.battleService
      .undoLastAction()
      .catch((error: unknown) => this.logger.error('DmControlComponent.undoLastAction', error));
  }

  resetScene(): void {
    if (!confirm('Are you sure you want to reset the entire battle?')) return;
    this.battleService
      .resetScene()
      .then(() => {
        this.showInitiativeRolls.set(false);
      })
      .catch((error: unknown) => this.logger.error('DmControlComponent.resetScene', error));
  }

  private resetDamagePanel(): void {
    this.damageAmount.set(0);
    this.damageTargetId.set(null);
    this.damageMode.set('single');
    this.selectedCombatantIds.set([]);
  }

  setCurrentTurn(combatantId: string): void {
    this.battleService
      .setCurrentTurn(combatantId)
      .catch((error: unknown) => this.logger.error('DmControlComponent.setCurrentTurn', error));
  }

  moveCombatant(combatantId: string, direction: -1 | 1): void {
    this.battleService
      .moveCombatant(combatantId, direction)
      .catch((error: unknown) => this.logger.error('DmControlComponent.moveCombatant', error));
  }

  private clampHealingAmount(): void {
    if (this.hpOperation() !== 'heal' || this.targetType() === 'selected') return;
    const maximum = this.maxHealingAmount();
    if (maximum !== null && this.damageAmount() > maximum) {
      this.damageAmount.set(maximum);
    }
  }
}
