import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
  computed,
  OnDestroy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { CharacterService } from '../../core/services/character.service';
import { BattleService } from '../../core/services/battle.service';
import { InventoryService } from '../../core/services/inventory.service';
import { LoggerService } from '../../core/services/logger.service';
import { Subscription } from 'rxjs';
import { CharacterParserService } from '../../core/services/characterParser.service';
import { LssCharacterSheet, ParsedCharacter } from '../../core/models/character.model';
import { InventoryItem } from '../../core/models/inventory-item.model';
import { Combatant } from '../../core/models/combatant.model';
import { COMBATANT_STATUS, COMBATANT_TYPE } from '../../core/constants/combatant.constants';

@Component({
  selector: 'app-player',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './player.component.html',
  styleUrl: './player.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlayerComponent implements OnDestroy {
  // --- Внедрённые сервисы ---
  private readonly parser = inject(CharacterParserService);
  private readonly characterService = inject(CharacterService);
  private readonly battleService = inject(BattleService);
  private readonly inventoryService = inject(InventoryService);
  private readonly logger = inject(LoggerService);

  // --- Внутреннее состояние ---
  private characterSubscription?: Subscription;

  // --- Состояние входа ---
  readonly loginName = signal('');
  readonly loginError = signal<string | null>(null);
  readonly isLoggedIn = signal(false);
  readonly showUploadPrompt = signal(false);

  // --- Состояние персонажа ---
  readonly character = signal<ParsedCharacter | null>(null);
  readonly error = signal<string | null>(null);
  readonly expandedAbility = signal<string | null>(null);

  // --- Навигация по вкладкам ---
  readonly activeTab = signal<'character' | 'arena'>('character');

  // --- Состояние арены/атаки ---
  readonly selectedEnemyId = signal<string | null>(null);
  readonly damageAmount = signal<number>(0);
  readonly selectedWeaponIndex = signal<number>(0);

  // --- Состояние модального окна использования предмета ---
  readonly modalMode = signal<'use' | 'examine'>('use');
  readonly showUseModal = signal(false);
  readonly useQuantity = signal(1);
  readonly selectedItemForUse = signal<InventoryItem | null>(null);

  // --- Данные из BattleService ---
  readonly COMBATANT_TYPE = COMBATANT_TYPE;
  readonly aliveEnemies = this.battleService.aliveEnemies;
  readonly combatantsInTurnOrder = this.battleService.sortedCombatants;
  readonly currentCombatant = this.battleService.currentCombatant;
  readonly currentRound = this.battleService.currentRound;

  // --- Производные значения ---
  readonly weapons = computed(() => this.character()?.weapons ?? []);

  readonly selectedWeapon = computed(() => {
    const weapons = this.weapons();
    return weapons[this.selectedWeaponIndex()] || null;
  });

  readonly selectedEnemy = computed(() => {
    const id = this.selectedEnemyId();
    if (!id) return null;
    return this.aliveEnemies().find((e) => e.id === id) ?? null;
  });

  readonly canAttack = computed(() => {
    return (
      this.selectedEnemy() !== null &&
      this.damageAmount() > 0 &&
      this.aliveEnemies().some((e) => e.id === this.selectedEnemy()!.id)
    );
  });

  ngOnDestroy(): void {
    this.characterSubscription?.unsubscribe();
  }

  onLoginInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.loginName.set(input.value);
  }

  login(): void {
    const name = this.loginName().trim();
    if (!name) {
      this.loginError.set('Введите имя персонажа');
      return;
    }
    this.characterService
      .characterExists(name)
      .then((exists) => {
        if (!exists) {
          this.loginError.set('Персонаж не найден. Загрузите JSON-файл.');
          this.showUploadPrompt.set(true);
          return;
        }
        return this.characterService.loadCharacter(name).then((charData) => {
          if (!charData) return;
          this.character.set(charData);
          this.isLoggedIn.set(true);
          this.loginError.set(null);
          this.showUploadPrompt.set(false);
          this.subscribeToCharacterUpdates(name);
          this.joinBattle(charData);
        });
      })
      .catch((error: unknown) => {
        this.logger.error('PlayerComponent.login', error);
        this.loginError.set('Ошибка при входе. Попробуйте позже.');
      });
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      let parsed: ParsedCharacter;
      try {
        const rawJson = JSON.parse(e.target?.result as string) as LssCharacterSheet;
        parsed = this.parser.parseCharacter(rawJson);
      } catch (error) {
        this.error.set('Не удалось распарсить файл. Убедитесь, что это JSON с LSS.');
        this.logger.error('PlayerComponent.onFileSelected', error);
        return;
      }
      this.characterService
        .saveCharacter(parsed)
        .then(() => {
          this.character.set(parsed);
          this.isLoggedIn.set(true);
          this.showUploadPrompt.set(false);
          this.loginError.set(null);
          this.loginName.set(parsed.name);
          this.subscribeToCharacterUpdates(parsed.name);
          this.joinBattle(parsed);
        })
        .catch((error: unknown) => this.logger.error('PlayerComponent.onFileSelected', error));
    };
    reader.readAsText(file);
  }

  private subscribeToCharacterUpdates(name: string): void {
    this.characterSubscription?.unsubscribe();
    this.characterSubscription = this.characterService
      .subscribeToCharacter(name)
      .subscribe((updated) => {
        if (updated) this.character.set(updated);
      });
  }

  private joinBattle(character: ParsedCharacter): void {
    void this.battleService
      .addPlayerToBattle(character, 0)
      .catch((error: unknown) => this.logger.error('PlayerComponent.joinBattle', error));
  }

  logout(): void {
    this.characterSubscription?.unsubscribe();
    this.character.set(null);
    this.isLoggedIn.set(false);
    this.loginName.set('');
    this.showUploadPrompt.set(false);
    this.loginError.set(null);
    this.selectedEnemyId.set(null);
    this.damageAmount.set(0);
  }

  switchTab(tab: 'character' | 'arena'): void {
    this.activeTab.set(tab);
  }

  getStatValue(stat: string): number {
    const char = this.character();
    if (!char) return 0;
    return char.stats[stat as keyof typeof char.stats] ?? 0;
  }

  getStatModString(stat: string): string {
    const value = this.getStatValue(stat);
    const mod = this.parser.getModifier(value);
    return mod > 0 ? `+${mod}` : `${mod}`;
  }

  toggleAbility(name: string): void {
    this.expandedAbility.set(this.expandedAbility() === name ? null : name);
  }

  selectEnemy(enemyId: string): void {
    this.selectedEnemyId.set(enemyId);
  }

  isSelectableEnemy(combatant: Combatant): boolean {
    return combatant.type === COMBATANT_TYPE.ENEMY && combatant.status === COMBATANT_STATUS.ALIVE;
  }

  selectCombatant(combatant: Combatant): void {
    if (!this.isSelectableEnemy(combatant)) return;
    this.selectEnemy(combatant.id);
  }

  clearSelection(): void {
    this.selectedEnemyId.set(null);
    this.damageAmount.set(0);
  }

  onWeaponChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.selectedWeaponIndex.set(+select.value);
  }

  onDamageInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const value = +input.value;
    if (!isNaN(value) && value >= 0) {
      this.damageAmount.set(value);
    } else {
      this.damageAmount.set(0);
    }
  }

  useItem(item: InventoryItem): void {
    this.selectedItemForUse.set(item);
    this.useQuantity.set(1);
    this.modalMode.set('use');
    this.showUseModal.set(true);
  }

  confirmAndUseItem(): void {
    const item = this.selectedItemForUse();
    const char = this.character();
    if (!item || this.modalMode() !== 'use' || !char) return;
    const quantity = this.useQuantity();

    this.inventoryService
      .consumeItem(char.name, item.id, quantity)
      .then((success) => {
        if (!success) {
          alert('Недостаточно предметов');
          return;
        }
        this.closeUseModal();
      })
      .catch((error: unknown) => this.logger.error('PlayerComponent.confirmAndUseItem', error));
  }

  closeUseModal(): void {
    this.showUseModal.set(false);
    this.selectedItemForUse.set(null);
    this.useQuantity.set(1);
    this.modalMode.set('use');
  }

  examineItem(item: InventoryItem): void {
    this.selectedItemForUse.set(item);
    this.modalMode.set('examine');
    this.showUseModal.set(true);
  }

  onUseQuantityInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const value = +input.value;
    const maxQty = this.selectedItemForUse()?.quantity ?? 1;
    if (isNaN(value) || value < 1) {
      this.useQuantity.set(1);
      return;
    }
    this.useQuantity.set(Math.min(value, maxQty));
  }

  attack(): void {
    if (!this.canAttack()) return;
    const enemy = this.selectedEnemy();
    if (!enemy) return;
    this.battleService
      .takeDamage(enemy.id, this.damageAmount())
      .then(() => this.damageAmount.set(0))
      .catch((error: unknown) => this.logger.error('PlayerComponent.attack', error));
  }
}
