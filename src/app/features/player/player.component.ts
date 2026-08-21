import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
  computed,
  OnDestroy,
} from '@angular/core';
import { CharacterService } from '../../core/services/character.service';
import { BattleService } from '../../core/services/battle.service';
import { InventoryService } from '../../core/services/inventory.service';
import { LoggerService } from '../../core/services/logger.service';
import { Subscription } from 'rxjs';
import { CharacterParserService } from '../../core/services/characterParser.service';
import {
  CharacterResource,
  LssCharacterSheet,
  ParsedCharacter,
} from '../../core/models/character.model';
import { InventoryItem } from '../../core/models/inventory-item.model';
import { ActiveStatusEffect, Combatant, SpellData } from '../../core/models/combatant.model';
import { COMBATANT_STATUS, COMBATANT_TYPE } from '../../core/constants/combatant.constants';
import { StatusEffectListComponent } from '../../shared/ui/status-effect-list/status-effect-list.component';
import { CombatantLifeStateComponent } from '../../shared/ui/combatant-life-state/combatant-life-state.component';
import { parseJsonWithTrailingCommaRecovery } from '../../core/utils';
import {
  STATUS_EFFECT_TRIGGER,
  STATUS_EFFECT_TYPE,
} from '../../core/constants/status-effect.constants';

const CHARACTER_STATS = [
  { key: 'str', label: 'СИЛ', title: 'Сила' },
  { key: 'dex', label: 'ЛОВ', title: 'Ловкость' },
  { key: 'con', label: 'ТЕЛ', title: 'Телосложение' },
  { key: 'int', label: 'ИНТ', title: 'Интеллект' },
  { key: 'wis', label: 'МДР', title: 'Мудрость' },
  { key: 'cha', label: 'ХАР', title: 'Харизма' },
] as const;

interface SpellDescriptionPart {
  text: string;
  isDice: boolean;
}

interface SpellUseConfirmation {
  spellName: string;
  isCantrip: boolean;
  slotLevel: number | null;
  resourceName?: string;
}

interface ResourceUseConfirmation {
  resourceName: string;
  icon: string;
  isUnlimited: boolean;
  remaining: number;
  max: number;
  spent: number;
  activated: boolean;
}

interface ResourceEffectConfirmation {
  resourceName: string;
  durationLabel: string;
  icon: string;
}

const DICE_NOTATION_PATTERN = /(\d+\s*[dдк]\s*\d+(?:\s*[+\-−]\s*\d+)?)/giu;
const EXACT_DICE_NOTATION_PATTERN = /^\d+\s*[dдк]\s*\d+(?:\s*[+\-−]\s*\d+)?$/iu;
const LAST_PLAYER_NAME_STORAGE_KEY = 'battle-forge:last-player-name';

@Component({
  selector: 'app-player',
  standalone: true,
  imports: [StatusEffectListComponent, CombatantLifeStateComponent],
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
  readonly lastLoginName = signal(this.loadLastLoginName());
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
  readonly attackMode = signal<'main' | 'additional'>('main');

  // --- Состояние использования заклинаний ---
  readonly usingSpellId = signal<string | null>(null);
  readonly spellUseError = signal<string | null>(null);
  readonly selectedSpellSlots = signal<Record<string, number>>({});
  readonly spellUseConfirmation = signal<SpellUseConfirmation | null>(null);
  readonly usingResourceId = signal<string | null>(null);
  readonly resourceUseError = signal<string | null>(null);
  readonly resourceUseConfirmation = signal<ResourceUseConfirmation | null>(null);
  readonly resourceEffectConfirmation = signal<ResourceEffectConfirmation | null>(null);
  readonly updatingResourceEffectId = signal<string | null>(null);
  readonly selectedResourceForUse = signal<CharacterResource | null>(null);
  readonly resourceUseAmount = signal(1);

  // --- Состояние модального окна использования предмета ---
  readonly modalMode = signal<'use' | 'examine'>('use');
  readonly showUseModal = signal(false);
  readonly useQuantity = signal(1);
  readonly selectedItemForUse = signal<InventoryItem | null>(null);

  // --- Данные из BattleService ---
  readonly COMBATANT_TYPE = COMBATANT_TYPE;
  readonly COMBATANT_STATUS = COMBATANT_STATUS;
  readonly CHARACTER_STATS = CHARACTER_STATS;
  readonly aliveEnemies = this.battleService.aliveEnemies;
  readonly combatantsInTurnOrder = this.battleService.sortedCombatants;
  readonly currentCombatant = this.battleService.currentCombatant;
  readonly currentRound = this.battleService.currentRound;

  // --- Производные значения ---
  readonly weapons = computed(() => this.character()?.weapons ?? []);
  readonly spellSlots = computed(() => this.character()?.spellSlots ?? []);
  readonly characterResources = computed(() => this.character()?.resources ?? []);

  readonly playerCombatant = computed(() => {
    const playerName = this.character()?.name;
    if (!playerName) return null;

    return (
      this.combatantsInTurnOrder().find(
        (combatant) =>
          combatant.type === COMBATANT_TYPE.PLAYER &&
          (combatant.playerName === playerName || combatant.id === `player_${playerName}`),
      ) ?? null
    );
  });

  readonly playerActiveEffects = computed(() => this.playerCombatant()?.activeEffects ?? []);

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
          this.rememberSuccessfulLogin(charData.name);
          this.subscribeToCharacterUpdates(name);
          this.joinBattle(charData);
        });
      })
      .catch((error: unknown) => {
        this.logger.error('PlayerComponent.login', error);
        this.loginError.set('Ошибка при входе. Попробуйте позже.');
      });
  }

  loginAsLastPlayer(): void {
    const name = this.lastLoginName();
    if (!name) return;
    this.loginName.set(name);
    this.login();
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      let parsed: ParsedCharacter;
      try {
        const rawJson = parseJsonWithTrailingCommaRecovery<LssCharacterSheet>(
          e.target?.result as string,
        );
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
          this.rememberSuccessfulLogin(parsed.name);
          this.subscribeToCharacterUpdates(parsed.name);
          this.joinBattle(parsed);
        })
        .catch((error: unknown) => this.logger.error('PlayerComponent.onFileSelected', error));
    };
    reader.readAsText(file);
  }

  private loadLastLoginName(): string | null {
    try {
      return globalThis.localStorage?.getItem(LAST_PLAYER_NAME_STORAGE_KEY)?.trim() || null;
    } catch (error) {
      this.logger.error('PlayerComponent.loadLastLoginName', error);
      return null;
    }
  }

  private rememberSuccessfulLogin(name: string): void {
    const normalizedName = name.trim();
    if (!normalizedName) return;
    this.lastLoginName.set(normalizedName);
    try {
      globalThis.localStorage?.setItem(LAST_PLAYER_NAME_STORAGE_KEY, normalizedName);
    } catch (error) {
      this.logger.error('PlayerComponent.rememberSuccessfulLogin', error);
    }
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
    this.usingSpellId.set(null);
    this.spellUseError.set(null);
    this.selectedSpellSlots.set({});
    this.spellUseConfirmation.set(null);
    this.usingResourceId.set(null);
    this.resourceUseError.set(null);
    this.resourceUseConfirmation.set(null);
    this.resourceEffectConfirmation.set(null);
    this.updatingResourceEffectId.set(null);
    this.selectedResourceForUse.set(null);
    this.resourceUseAmount.set(1);
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

  getSpellMaxUses(spell: SpellData): number {
    return Math.max(1, spell.maxUses ?? 1);
  }

  getSpellUsesRemaining(spell: SpellData): number {
    return Math.max(0, spell.usesRemaining ?? this.getSpellMaxUses(spell));
  }

  spellDescriptionParts(description: string): SpellDescriptionPart[] {
    return description
      .split(DICE_NOTATION_PATTERN)
      .filter((text) => text.length > 0)
      .map((text) => ({ text, isDice: EXACT_DICE_NOTATION_PATTERN.test(text) }));
  }

  getAvailableSlotLevels(spell: SpellData): number[] {
    return this.spellSlots()
      .filter((slot) => slot.level >= spell.level && slot.current > 0)
      .map((slot) => slot.level);
  }

  getSelectedSlotLevel(spell: SpellData): number {
    const available = this.getAvailableSlotLevels(spell);
    const selected = this.selectedSpellSlots()[spell.id];
    return available.includes(selected) ? selected : (available[0] ?? spell.level);
  }

  setSpellSlotLevel(spellId: string, event: Event): void {
    const level = Math.max(1, Math.min(9, Number((event.target as HTMLSelectElement).value)));
    this.selectedSpellSlots.update((slots) => ({ ...slots, [spellId]: level }));
  }

  hasSharedSpellSlots(): boolean {
    return this.spellSlots().length > 0;
  }

  canUseSpell(spell: SpellData): boolean {
    if (!spell.isPrepared) return false;
    if (spell.isCantrip) return true;
    return this.hasSharedSpellSlots()
      ? this.getAvailableSlotLevels(spell).length > 0
      : this.getSpellUsesRemaining(spell) > 0;
  }

  linkedSpellResources(spell: SpellData): CharacterResource[] {
    return this.characterResources().filter(
      (resource) =>
        resource.linkedSpellId === spell.id &&
        (resource.isUnlimited || resource.current >= (resource.spendAmount ?? 1)),
    );
  }

  useSpell(spell: SpellData): void {
    const character = this.character();
    if (!character || !this.canUseSpell(spell) || this.usingSpellId() !== null) return;

    const usesSharedSlot = !spell.isCantrip && this.hasSharedSpellSlots();
    const selectedSlotLevel = usesSharedSlot ? this.getSelectedSlotLevel(spell) : undefined;

    this.usingSpellId.set(spell.id);
    this.spellUseError.set(null);
    this.spellUseConfirmation.set(null);
    this.characterService
      .usePlayerSpell(character.name, spell.id, selectedSlotLevel)
      .then((success) => {
        if (!success) {
          this.spellUseError.set('Заклинание сейчас нельзя использовать. Обновите персонажа.');
          return;
        }

        this.spellUseConfirmation.set({
          spellName: spell.name,
          isCantrip: spell.isCantrip,
          slotLevel: selectedSlotLevel ?? null,
        });
      })
      .catch((error: unknown) => {
        this.logger.error('PlayerComponent.useSpell', error);
        this.spellUseError.set('Не удалось отметить использование заклинания. Попробуйте ещё раз.');
      })
      .finally(() => this.usingSpellId.set(null));
  }

  closeSpellUseConfirmation(): void {
    this.spellUseConfirmation.set(null);
  }

  useSpellWithResource(spell: SpellData, resource: CharacterResource): void {
    const character = this.character();
    const amount = Math.max(1, resource.spendAmount ?? 1);
    if (
      !character ||
      !spell.isPrepared ||
      (!resource.isUnlimited && resource.current < amount) ||
      this.usingSpellId() !== null
    ) return;

    this.usingSpellId.set(spell.id);
    this.spellUseError.set(null);
    this.spellUseConfirmation.set(null);
    this.characterService
      .useResource(character.name, resource.id, amount)
      .then((success) => {
        if (!success) {
          this.spellUseError.set('Бесплатное применение уже израсходовано.');
          return;
        }
        this.spellUseConfirmation.set({
          spellName: spell.name,
          isCantrip: false,
          slotLevel: null,
          resourceName: resource.name,
        });
      })
      .catch((error: unknown) => {
        this.logger.error('PlayerComponent.useSpellWithResource', error);
        this.spellUseError.set('Не удалось отметить бесплатное применение заклинания.');
      })
      .finally(() => this.usingSpellId.set(null));
  }

  useResource(resourceId: string, requestedAmount?: number): void {
    const character = this.character();
    const resource = this.characterResources().find((candidate) => candidate.id === resourceId);
    if (
      !character ||
      !resource ||
      (!resource.isUnlimited && resource.current <= 0) ||
      this.usingResourceId()
    ) return;
    if (this.activeResourceEffect(resource.id)) return;

    if (resource.spendMode === 'variable' && requestedAmount === undefined) {
      this.selectedResourceForUse.set(resource);
      this.resourceUseAmount.set(1);
      this.resourceUseError.set(null);
      return;
    }
    const amount = resource.isUnlimited
      ? 1
      : Math.max(1, Math.min(resource.current, requestedAmount ?? resource.spendAmount ?? 1));
    this.performResourceUse(character.name, resource, amount);
  }

  confirmResourceUse(): void {
    const resource = this.selectedResourceForUse();
    if (!resource) return;
    const amount = this.resourceUseAmount();
    this.closeResourceUseDialog();
    this.useResource(resource.id, amount);
  }

  closeResourceUseDialog(): void {
    this.selectedResourceForUse.set(null);
    this.resourceUseAmount.set(1);
  }

  setResourceUseAmount(event: Event): void {
    const resource = this.selectedResourceForUse();
    const value = Math.floor(Number((event.target as HTMLInputElement).value) || 1);
    this.resourceUseAmount.set(Math.max(1, Math.min(resource?.current ?? 1, value)));
  }

  activeResourceEffect(resourceId: string): ActiveStatusEffect | null {
    return this.playerActiveEffects().find((effect) => effect.resourceId === resourceId) ?? null;
  }

  extendResourceEffect(resourceId: string): void {
    const combatant = this.playerCombatant();
    const resource = this.characterResources().find((candidate) => candidate.id === resourceId);
    const effect = this.activeResourceEffect(resourceId);
    if (!combatant || !resource?.activeEffect || !effect || this.updatingResourceEffectId()) return;
    const duration = this.resourceEffectDuration(resource);
    if (!duration) return;
    this.updatingResourceEffectId.set(resourceId);
    this.resourceEffectConfirmation.set(null);
    this.battleService
      .refreshStatusEffect(combatant.id, effect.id, duration.triggers, duration.label)
      .then((success) => {
        if (!success) {
          this.resourceUseError.set('Не удалось продлить активный ресурс.');
          return;
        }
        this.resourceEffectConfirmation.set({
          resourceName: resource.name,
          durationLabel: duration.label,
          icon: resource.icon ?? resource.activeEffect?.icon ?? '⚡',
        });
      })
      .catch((error: unknown) => {
        this.logger.error('PlayerComponent.extendResourceEffect', error);
        this.resourceUseError.set('Не удалось продлить активный ресурс.');
      })
      .finally(() => this.updatingResourceEffectId.set(null));
  }

  closeResourceEffectConfirmation(): void {
    this.resourceEffectConfirmation.set(null);
  }

  endResourceEffect(resourceId: string): void {
    const combatant = this.playerCombatant();
    const effect = this.activeResourceEffect(resourceId);
    if (!combatant || !effect) return;
    this.battleService
      .removeStatusEffect(combatant.id, effect.id)
      .catch((error: unknown) => this.logger.error('PlayerComponent.endResourceEffect', error));
  }

  private performResourceUse(
    playerName: string,
    resource: CharacterResource,
    amount: number,
  ): void {
    this.usingResourceId.set(resource.id);
    this.resourceUseError.set(null);
    this.resourceUseConfirmation.set(null);
    this.characterService
      .useResource(playerName, resource.id, amount)
      .then(async (success) => {
        if (!success) {
          this.resourceUseError.set('Ресурс уже исчерпан или был изменён.');
          return;
        }
        const activated = await this.activateResourceEffect(resource);
        this.resourceUseConfirmation.set({
          resourceName: resource.name,
          icon: resource.icon ?? resource.activeEffect?.icon ?? '⚡',
          isUnlimited: resource.isUnlimited === true,
          remaining: resource.isUnlimited ? 0 : Math.max(0, resource.current - amount),
          max: resource.max,
          spent: resource.isUnlimited ? 0 : amount,
          activated,
        });
      })
      .catch((error: unknown) => {
        this.logger.error('PlayerComponent.useResource', error);
        this.resourceUseError.set('Не удалось списать ресурс.');
      })
      .finally(() => this.usingResourceId.set(null));
  }

  private async activateResourceEffect(resource: CharacterResource): Promise<boolean> {
    const combatant = this.playerCombatant();
    if (!combatant || !resource.activeEffect) return false;
    const duration = this.resourceEffectDuration(resource);
    return this.battleService.addStatusEffect(combatant.id, STATUS_EFFECT_TYPE.RESOURCE_ACTIVE, {
      resourceId: resource.id,
      customLabel: resource.name,
      customIcon: resource.icon ?? resource.activeEffect.icon,
      source: resource.name,
      notes: resource.description,
      ...(duration
        ? {
            trigger: STATUS_EFFECT_TRIGGER.TURN_END,
            durationTriggers: duration.triggers,
            durationLabel: duration.label,
          }
        : {}),
    });
  }

  private resourceEffectDuration(
    resource: CharacterResource,
  ): { triggers: number; label: string } | null {
    const effect = resource.activeEffect;
    if (!effect || effect.duration === 'manual') return null;
    const ownTurnIsActive = this.currentCombatant()?.id === this.playerCombatant()?.id;
    const rounds = effect.duration === 'rounds' ? Math.max(1, effect.rounds ?? 1) : 1;
    return {
      triggers: rounds + (ownTurnIsActive ? 1 : 0),
      label: effect.duration === 'until-next-turn-end'
        ? 'до конца следующего хода'
        : `${rounds} раунд${rounds === 1 ? '' : rounds < 5 ? 'а' : 'ов'}`,
    };
  }

  closeResourceUseConfirmation(): void {
    this.resourceUseConfirmation.set(null);
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
    this.attackMode.set('main');
  }

  onWeaponChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.selectedWeaponIndex.set(+select.value);
  }

  setAttackMode(mode: 'main' | 'additional'): void {
    this.attackMode.set(mode);
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
      .then(() => {
        this.damageAmount.set(0);
        this.attackMode.set('additional');
      })
      .catch((error: unknown) => this.logger.error('PlayerComponent.attack', error));
  }
}
