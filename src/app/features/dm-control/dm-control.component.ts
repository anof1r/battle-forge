import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { KeyValuePipe, UpperCasePipe } from '@angular/common';
import { BattleService } from '../../core/services/battle.service';
import { CharacterService } from '../../core/services/character.service';
import { InventoryService } from '../../core/services/inventory.service';
import { LoggerService } from '../../core/services/logger.service';
import { Combatant, SpellData } from '../../core/models/combatant.model';
import { BATTLE_STATUS } from '../../core/constants/battle-status.constants';
import { COMBATANT_STATUS, COMBATANT_TYPE } from '../../core/constants/combatant.constants';
import { ItemRarity, ITEM_RARITY } from '../../core/constants/item-rarity.constants';
import {
  getStatusEffectDefinition,
  STATUS_EFFECT_DEFINITIONS,
  STATUS_EFFECT_TYPE,
  StatusEffectType,
} from '../../core/constants/status-effect.constants';
import { DmSceneLibraryComponent } from './scene-library/dm-scene-library.component';

@Component({
  selector: 'app-dm-control',
  standalone: true,
  imports: [UpperCasePipe, KeyValuePipe, DmSceneLibraryComponent],
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

  readonly activePanel = signal<'scenes' | 'battle' | 'rewards'>('scenes');

  // --- Панель изменения HP ---
  readonly hpOperation = signal<'damage' | 'heal'>('damage');
  readonly targetType = signal<'enemies' | 'players' | 'all'>('enemies');
  readonly damageTargetId = signal<string | null>(null);
  readonly damageAmount = signal(0);
  readonly damageMode = signal<'single' | 'all'>('single');

  // --- Панель статус-эффектов ---
  readonly STATUS_EFFECT_DEFINITIONS = STATUS_EFFECT_DEFINITIONS;
  readonly selectedStatusTargetId = signal<string | null>(null);
  readonly selectedStatusEffect = signal<StatusEffectType>(STATUS_EFFECT_TYPE.POISONED);
  readonly applyingStatus = signal(false);
  readonly removingEffectId = signal<string | null>(null);
  readonly statusError = signal<string | null>(null);

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
  readonly spellMaxUses = signal(1);
  readonly isSpellCantrip = computed(() => this.spellLevel() === 0);

  // --- UI подготовки/инициативы ---
  readonly showInitiativeRolls = signal(false);
  readonly initiativeRolls = signal<Record<string, number>>({});

  // --- Данные из BattleService ---
  readonly battleStatus = this.battleService.battleStatus;
  readonly aliveEnemies = this.battleService.aliveEnemies;
  readonly sortedByInitiative = this.battleService.sortedCombatants;
  readonly currentRound = this.battleService.currentRound;
  readonly currentEnemy = this.battleService.currentCombatant;
  readonly playersInBattle = this.battleService.playersInBattle;

  // --- Производные значения ---
  readonly allCombatants = computed(() => Object.values(this.battleService.combatants()));
  readonly enemiesList = computed(() => Object.values(this.battleService.enemies()));

  readonly canApplyDamage = computed(() => {
    if (this.targetType() === 'all') {
      return this.damageAmount() > 0 && this.aliveEnemies().length > 0;
    }
    return this.damageAmount() > 0 && !!this.damageTargetId();
  });

  readonly canApplyHealing = computed(
    () =>
      this.targetType() !== 'all' && this.damageAmount() > 0 && !!this.damageTargetId(),
  );

  readonly selectedStatusTarget = computed(() => {
    const targetId = this.selectedStatusTargetId();
    return targetId ? this.battleService.combatants()[targetId] ?? null : null;
  });

  readonly canApplyStatus = computed(() => {
    const target = this.selectedStatusTarget();
    return (
      !!target &&
      !(target.activeEffects ?? []).some((effect) => effect.type === this.selectedStatusEffect())
    );
  });

  readonly combatantsWithEffects = computed(() =>
    this.sortedByInitiative().filter((combatant) => (combatant.activeEffects?.length ?? 0) > 0),
  );

  readonly availableTargets = computed(() => {
    const type = this.targetType();
    if (type === 'enemies') {
      return this.aliveEnemies();
    } else if (type === 'players') {
      const playersObj = this.playersInBattle();
      return Object.values(playersObj).filter((p) => p.status === COMBATANT_STATUS.ALIVE);
    } else {
      return [];
    }
  });

  ngOnInit(): void {
    this.loadPlayersToBattleSilent();
  }

  // Adds players sequentially — each write reads/appends to the shared initiativeOrder array,
  // so running them in parallel would race and drop entries.
  private loadPlayersToBattleSilent(): Promise<void> {
    return this.characterService
      .getAllPlayers()
      .then((players) =>
        players.reduce<Promise<void>>(
          (chain, player) => chain.then(() => this.battleService.addPlayerToBattle(player, 0)),
          Promise.resolve(),
        ),
      )
      .catch((error: unknown) =>
        this.logger.error('DmControlComponent.loadPlayersToBattle', error),
      );
  }

  removePlayerFromBattle(playerId: string): void {
    const playerName = playerId.replace('player_', '');
    this.battleService
      .removePlayerFromBattle(playerName)
      .catch((error: unknown) =>
        this.logger.error('DmControlComponent.removePlayerFromBattle', error),
      );
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

  onSpellMaxUsesInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const maxUses = Number(input.value);
    this.spellMaxUses.set(Math.max(1, Number.isFinite(maxUses) ? Math.floor(maxUses) : 1));
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
      ...(level === 0
        ? {}
        : { maxUses: this.spellMaxUses(), usesRemaining: this.spellMaxUses() }),
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
    this.spellMaxUses.set(1);
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
  }

  onSelectPlayerForItem(event: Event): void {
    const select = event.target as HTMLSelectElement;
    const value = select.value;
    this.selectedPlayerIdForItem.set(value && value !== 'null' ? value : null);
  }

  onDamageAmountInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const value = Number(input.value);
    this.damageAmount.set(value > 0 ? value : 0);
  }

  onStatusTargetChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.selectedStatusTargetId.set(select.value || null);
    this.statusError.set(null);
  }

  selectStatusEffect(type: StatusEffectType): void {
    this.selectedStatusEffect.set(type);
    this.statusError.set(null);
  }

  statusEffectDefinition(type: StatusEffectType) {
    return getStatusEffectDefinition(type);
  }

  setHpOperation(operation: 'damage' | 'heal'): void {
    this.hpOperation.set(operation);
    if (operation === 'heal' && this.targetType() === 'all') {
      this.targetType.set('enemies');
    }
    this.resetDamagePanel();
  }

  onItemQuantityInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const value = Number(input.value);
    this.itemQuantity.set(value > 0 ? value : 1);
  }

  loadPlayersToBattle(): void {
    this.loadPlayersToBattleSilent().then(() => {
      alert('Игроки загружены. Теперь задайте им инициативу в панели инициативы.');
    });
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

    const targetId = this.damageTargetId();
    if (!targetId) return;

    this.battleService
      .takeDamage(targetId, amount)
      .then(() => this.resetDamagePanel())
      .catch((error: unknown) => this.logger.error('DmControlComponent.applyDamage', error));
  }

  applyHealing(): void {
    if (!this.canApplyHealing()) return;
    const targetId = this.damageTargetId();
    if (!targetId) return;

    this.battleService
      .heal(targetId, this.damageAmount())
      .then(() => this.resetDamagePanel())
      .catch((error: unknown) => this.logger.error('DmControlComponent.applyHealing', error));
  }

  applyStatusEffect(): void {
    const targetId = this.selectedStatusTargetId();
    if (!targetId || !this.canApplyStatus() || this.applyingStatus()) return;

    this.applyingStatus.set(true);
    this.statusError.set(null);
    this.battleService
      .addStatusEffect(targetId, this.selectedStatusEffect())
      .then((added) => {
        if (!added) this.statusError.set('Эффект уже назначен или участник больше недоступен.');
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
    this.battleService
      .nextTurn()
      .catch((error: unknown) => this.logger.error('DmControlComponent.nextTurn', error));
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
  }
}
