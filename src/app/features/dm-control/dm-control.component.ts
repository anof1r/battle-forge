import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { KeyValuePipe, UpperCasePipe } from '@angular/common';
import { BattleService } from '../../core/services/battle.service';
import { HpBarComponent } from '../../shared/ui/hp-bar/hp-bar.component';
import { CharacterService } from '../../core/services/character.service';
import { InventoryService } from '../../core/services/inventory.service';
import { EnemyGeneratorService } from '../../core/services/enemy-generator.service';
import { LoggerService } from '../../core/services/logger.service';
import { Combatant } from '../../core/models/combatant.model';
import { EnemyIconComponent } from '../../shared/ui/enemy-icon/enemy-icon.component';
import { BATTLE_STATUS } from '../../core/constants/battle-status.constants';
import { COMBATANT_STATUS, COMBATANT_TYPE } from '../../core/constants/combatant.constants';
import { ItemRarity, ITEM_RARITY } from '../../core/constants/item-rarity.constants';
import {
  DEFAULT_ENEMY_AC,
  DEFAULT_ENEMY_MAX_HP,
  DEFAULT_ENEMY_TYPE,
} from '../../core/constants/enemy-generator.constants';

@Component({
  selector: 'app-dm-control',
  standalone: true,
  imports: [FormsModule, UpperCasePipe, KeyValuePipe],
  templateUrl: './dm-control.component.html',
  styleUrl: './dm-control.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DmControlComponent {
  // --- Внедрённые сервисы ---
  private readonly battleService = inject(BattleService);
  private readonly characterService = inject(CharacterService);
  private readonly inventoryService = inject(InventoryService);
  private readonly enemyGenerator = inject(EnemyGeneratorService);
  private readonly logger = inject(LoggerService);

  // --- Константы для шаблона ---
  readonly BATTLE_STATUS = BATTLE_STATUS;

  // --- Форма добавления врага ---
  readonly newEnemyName = signal('');
  readonly newEnemyType = signal(DEFAULT_ENEMY_TYPE);
  readonly newEnemyMaxHp = signal(DEFAULT_ENEMY_MAX_HP);
  readonly newEnemyAc = signal(DEFAULT_ENEMY_AC);

  // --- Панель урона ---
  readonly targetType = signal<'enemies' | 'players' | 'all'>('enemies');
  readonly damageTargetId = signal<string | null>(null);
  readonly damageAmount = signal(0);
  readonly damageMode = signal<'single' | 'all'>('single');

  // --- Панель выдачи предметов ---
  readonly selectedPlayerIdForItem = signal<string | null>(null);
  readonly itemName = signal('');
  readonly itemDescription = signal('');
  readonly itemQuantity = signal(1);
  readonly itemRarity = signal<ItemRarity>(ITEM_RARITY.COMMON);

  // --- UI подготовки/инициативы ---
  readonly showAddForm = signal(true);
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

  onItemQuantityInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const value = Number(input.value);
    this.itemQuantity.set(value > 0 ? value : 1);
  }

  addEnemy(): void {
    const name = this.newEnemyName().trim();
    if (!name || this.newEnemyMaxHp() <= 0) return;

    const flavor = this.enemyGenerator.generateFlavor();

    const enemyData: Omit<Combatant, 'id' | 'initiative' | 'currentHp' | 'status' | 'lastUpdated'> =
      {
        type: COMBATANT_TYPE.ENEMY,
        subtype: this.newEnemyType(),
        name,
        ac: this.newEnemyAc(),
        maxHp: this.newEnemyMaxHp(),
        actions: flavor.actions,
        statuses: flavor.statuses,
        resistances: flavor.resistances,
      };

    this.battleService
      .addEnemy(enemyData)
      .then(() => this.resetEnemyForm())
      .catch((error: unknown) => this.logger.error('DmControlComponent.addEnemy', error));
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

  onHpInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const value = Number(input.value);
    this.newEnemyMaxHp.set(value > 0 ? value : 0);
  }

  onAcInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const value = Number(input.value);
    this.newEnemyAc.set(value > 0 ? value : 0);
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
        this.showAddForm.set(false);
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
        this.showAddForm.set(true);
        this.showInitiativeRolls.set(false);
      })
      .catch((error: unknown) => this.logger.error('DmControlComponent.resetScene', error));
  }

  randomizeAllEnemies(): void {
    const enemies = this.enemiesList();
    if (enemies.length === 0) {
      alert('Нет врагов для рандомизации');
      return;
    }

    Promise.all(
      enemies.map((enemy) => {
        const flavor = this.enemyGenerator.generateFlavor();
        return this.battleService.updateEnemy(enemy.id, {
          actions: flavor.actions,
          statuses: flavor.statuses,
          resistances: flavor.resistances,
        });
      }),
    ).catch((error: unknown) => this.logger.error('DmControlComponent.randomizeAllEnemies', error));
  }

  private resetEnemyForm(): void {
    this.newEnemyName.set('');
    this.newEnemyType.set(DEFAULT_ENEMY_TYPE);
    this.newEnemyMaxHp.set(DEFAULT_ENEMY_MAX_HP);
    this.newEnemyAc.set(DEFAULT_ENEMY_AC);
  }

  private resetDamagePanel(): void {
    this.damageAmount.set(0);
    this.damageTargetId.set(null);
    this.damageMode.set('single');
  }
}
