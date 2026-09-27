import {
  WorkspaceComponent,
  WorkspaceToolDirective,
} from '../../shared/ui/workspace/workspace.component';
import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
  computed,
  OnDestroy,
  ElementRef,
  viewChild,
  afterRenderEffect,
} from '@angular/core';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { CharacterService } from '../../core/services/character.service';
import { BattleService } from '../../core/services/battle.service';
import { InventoryService } from '../../core/services/inventory.service';
import { LoggerService } from '../../core/services/logger.service';
import { DisplaySettingsService } from '../../core/services/display-settings.service';
import { Subscription } from 'rxjs';
import { CharacterParserService } from '../../core/services/characterParser.service';
import { ParsedCharacter } from '../../core/models/character.model';
import { CharacterResource } from '../../core/models/character-resource.model';
import { LssCharacterSheet } from '../../core/models/lss-character.model';
import { CharacterSkill, CharacterStatKey } from '../../core/models/character-skill.model';
import { InventoryItem } from '../../core/models/inventory-item.model';
import { ActiveStatusEffect, Combatant, SpellData } from '../../core/models/combatant.model';
import { COMBATANT_STATUS, COMBATANT_TYPE } from '../../core/constants/combatant.constants';
import { StatusEffectListComponent } from '../../shared/ui/status-effect-list/status-effect-list.component';
import { CombatantLifeStateComponent } from '../../shared/ui/combatant-life-state/combatant-life-state.component';
import { LanguageSwitcherComponent } from '../../shared/ui/language-switcher/language-switcher.component';
import { AvatarComponent } from '../../shared/ui/avatar/avatar.component';
import {
  formatSignedModifier,
  clampInteger,
  isPositiveInteger,
  getAbilityModifier,
  getSpellMaxUses,
  getSpellUsesRemaining,
  getWeaponAttackBonus,
  parseJsonWithTrailingCommaRecovery,
} from '../../core/utils';
import {
  STATUS_EFFECT_TRIGGER,
  STATUS_EFFECT_TYPE,
} from '../../core/constants/status-effect.constants';
import {
  CHARACTER_STATS,
  DICE_NOTATION_PATTERN,
  EXACT_DICE_NOTATION_PATTERN,
  LAST_PLAYER_NAME_STORAGE_KEY,
} from './player.constants';
import {
  CharacterWeaponView,
  SpellDescriptionPart,
  SpellUseConfirmation,
} from './player-view.model';

import {
  createSessionState,
  createSheetState,
  createAttackState,
  createSpellState,
  createResourceState,
  createInventoryState,
} from './player-state.model';

@Component({
  selector: 'app-player',
  standalone: true,
  imports: [
    WorkspaceComponent,
    WorkspaceToolDirective,
    TranslocoPipe,
    StatusEffectListComponent,
    CombatantLifeStateComponent,
    LanguageSwitcherComponent,
    AvatarComponent,
  ],
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
  private readonly i18n = inject(TranslocoService);
  private readonly displaySettings = inject(DisplaySettingsService);

  // --- Внутреннее состояние ---
  private characterSubscription?: Subscription;
  private sessionVersion = 0;
  readonly session = signal(createSessionState(this.loadLastLoginName()));
  readonly sheet = signal(createSheetState());
  readonly attackState = signal(createAttackState());
  readonly spellState = signal(createSpellState());
  readonly resourceState = signal(createResourceState());
  readonly inventoryState = signal(createInventoryState());

  // --- Состояние персонажа ---
  readonly character = signal<ParsedCharacter | null>(null);
  private readonly itemConfirmationDialog =
    viewChild<ElementRef<HTMLDialogElement>>('itemConfirmationDialog');
  private readonly syncItemConfirmation = afterRenderEffect(() => {
    const dialog = this.itemConfirmationDialog()?.nativeElement;
    if (dialog && !dialog.open) dialog.showModal();
  });

  readonly COMBATANT_TYPE = COMBATANT_TYPE;
  readonly COMBATANT_STATUS = COMBATANT_STATUS;
  readonly CHARACTER_STATS = CHARACTER_STATS;
  readonly aliveEnemies = this.battleService.aliveEnemies;
  readonly combatantsInTurnOrder = this.battleService.sortedCombatants;
  readonly currentCombatant = this.battleService.currentCombatant;
  readonly currentRound = this.battleService.currentRound;
  readonly showEnemyArmorClass = this.displaySettings.showEnemyArmorClass;
  readonly showEnemyHealth = this.displaySettings.showEnemyHealth;

  readonly weapons = computed(() => this.character()?.weapons ?? []);
  readonly weaponCards = computed<CharacterWeaponView[]>(() => {
    const character = this.character();
    if (!character) return [];

    return character.weapons.map((weapon) => {
      const attackBonus = getWeaponAttackBonus(
        weapon,
        character.stats,
        character.level,
        character.proficiencyBonus,
      );
      return {
        weapon,
        attackBonus: attackBonus === null ? null : formatSignedModifier(attackBonus),
      };
    });
  });
  readonly spellSlots = computed(() => this.character()?.spellSlots ?? []);
  readonly characterResources = computed(() => this.character()?.resources ?? []);
  readonly spellCastingResources = computed(() => {
    const resourceIds = new Set(
      (this.character()?.spells ?? [])
        .map((spell) => spell.resourceId?.trim())
        .filter((resourceId): resourceId is string => Boolean(resourceId)),
    );
    return this.characterResources().filter((resource) => resourceIds.has(resource.id));
  });
  readonly skillsByStat = computed<Record<CharacterStatKey, CharacterSkill[]>>(() => {
    const grouped: Record<CharacterStatKey, CharacterSkill[]> = {
      str: [],
      dex: [],
      con: [],
      int: [],
      wis: [],
      cha: [],
    };
    for (const skill of this.character()?.skills ?? []) {
      grouped[skill.baseStat].push(skill);
    }
    return grouped;
  });

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
    return weapons[this.attackState().weaponIndex] || null;
  });

  readonly selectedWeaponAttackBonus = computed(
    () => this.weaponCards()[this.attackState().weaponIndex]?.attackBonus ?? null,
  );

  readonly selectedEnemy = computed(() => {
    const id = this.attackState().enemyId;
    if (!id) return null;
    return this.aliveEnemies().find((e) => e.id === id) ?? null;
  });

  readonly canAttack = computed(() => {
    return (
      this.selectedEnemy() !== null &&
      this.attackState().damage > 0 &&
      Number.isFinite(this.attackState().damage)
    );
  });

  ngOnDestroy(): void {
    ++this.sessionVersion;
    this.characterSubscription?.unsubscribe();
  }

  onLoginInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.session.update((state) => ({ ...state, name: input.value }));
  }

  login(): void {
    const version = ++this.sessionVersion;
    const name = this.session().name.trim();
    if (!name) {
      this.session.update((state) => ({
        ...state,
        error: this.i18n.translate('player.error.enterName'),
      }));
      return;
    }
    this.resetWorkflows();
    this.characterService
      .characterExists(name)
      .then(async (exists) => {
        if (version !== this.sessionVersion) return;
        const character = exists ? await this.characterService.loadCharacter(name) : null;
        if (version !== this.sessionVersion) return;
        if (!character) {
          this.session.update((state) => ({
            ...state,
            uploadPrompt: true,
            error: this.i18n.translate('player.error.notFound'),
          }));
          return;
        }
        this.startCharacterSession(character);
      })
      .catch((error: unknown) => {
        this.logger.error('PlayerComponent.login', error);
        if (version !== this.sessionVersion) return;
        this.session.update((state) => ({
          ...state,
          error: this.i18n.translate('player.error.login'),
        }));
      });
  }

  private startCharacterSession(character: ParsedCharacter): void {
    this.resetWorkflows();
    this.character.set(character);
    this.session.update((state) => ({
      ...state,
      name: character.name,
      loggedIn: true,
      error: null,
      uploadPrompt: false,
    }));
    this.rememberSuccessfulLogin(character.name);
    this.subscribeToCharacterUpdates(character.name);
    this.joinBattle(character);
  }

  private resetWorkflows(): void {
    this.closeItemUseConfirmation();
    this.sheet.set(createSheetState());
    this.attackState.set(createAttackState());
    this.spellState.set(createSpellState());
    this.resourceState.set(createResourceState());
    this.inventoryState.set(createInventoryState());
  }

  setSheetTool(tool: string | null): void {
    this.sheet.update((state) => ({ ...state, tool }));
  }

  loginAsLastPlayer(): void {
    const name = this.session().lastName;
    if (!name) return;
    this.session.update((state) => ({ ...state, name: name }));
    this.login();
  }

  onFileSelected(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const version = ++this.sessionVersion;
    this.sheet.update((state) => ({ ...state, error: null }));
    this.resetWorkflows();
    const reader = new FileReader();
    reader.onerror = () => {
      if (version === this.sessionVersion) this.reportImportError(reader.error);
    };
    reader.onload = (event) => {
      if (version !== this.sessionVersion) return;
      let parsed: ParsedCharacter;
      try {
        const rawJson = parseJsonWithTrailingCommaRecovery<LssCharacterSheet>(
          event.target?.result as string,
        );
        parsed = this.parser.parseCharacter(rawJson);
      } catch (error) {
        this.reportImportError(error, 'player.error.parseJson');
        return;
      }
      this.characterService
        .loadCharacter(parsed.name)
        .then(async (existingCharacter) => {
          if (version !== this.sessionVersion) return;
          const importedCharacter = existingCharacter?.avatar
            ? { ...parsed, avatar: existingCharacter.avatar }
            : parsed;
          await this.characterService.saveCharacter(importedCharacter);
          if (version !== this.sessionVersion) return;
          this.startCharacterSession(importedCharacter);
        })
        .catch((error: unknown) => {
          if (version === this.sessionVersion) this.reportImportError(error);
          else this.logger.error('PlayerComponent.onFileSelected', error);
        });
    };
    reader.readAsText(file);
  }

  private reportImportError(error: unknown, key = 'player.error.importFile'): void {
    this.logger.error('PlayerComponent.onFileSelected', error);
    this.sheet.update((state) => ({ ...state, error: this.i18n.translate(key) }));
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
    this.session.update((state) => ({ ...state, lastName: normalizedName }));
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
    ++this.sessionVersion;
    this.characterSubscription?.unsubscribe();
    this.characterSubscription = undefined;
    this.resetWorkflows();
    this.character.set(null);
    this.session.set(createSessionState(this.session().lastName));
  }

  switchTab(tab: 'character' | 'arena' | 'settings'): void {
    this.sheet.update((state) => ({ ...state, tab: tab }));
  }

  getStatValue(stat: string): number {
    const char = this.character();
    if (!char) return 0;
    return char.stats[stat as keyof typeof char.stats] ?? 0;
  }

  getStatModString(stat: string): string {
    const modifier = getAbilityModifier(this.getStatValue(stat));
    return modifier === 0 ? '0' : formatSignedModifier(modifier);
  }

  toggleAbility(name: string): void {
    this.sheet.update((state) => ({
      ...state,
      expandedAbility: this.sheet().expandedAbility === name ? null : name,
    }));
  }

  getSkillName(skill: CharacterSkill): string {
    const key = 'character.skills.' + skill.id;
    const translated = this.i18n.translate(key);
    return translated === key ? skill.name : translated;
  }

  getSkillModString(modifier: number): string {
    return formatSignedModifier(modifier);
  }

  getSkillProficiencyLabel(skill: CharacterSkill): string {
    return this.i18n.translate('player.proficiency.' + skill.proficiency);
  }

  readonly getSpellMaxUses = getSpellMaxUses;

  readonly getSpellUsesRemaining = getSpellUsesRemaining;

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
    const selected = this.spellState().selectedSlots[spell.id];
    return available.includes(selected) ? selected : (available[0] ?? spell.level);
  }

  setSpellSlotLevel(spellId: string, event: Event): void {
    const level = clampInteger((event.target as HTMLSelectElement).value, 1, 9);
    this.spellState.update((state) => ({
      ...state,
      selectedSlots: { ...state.selectedSlots, [spellId]: level },
    }));
  }

  hasSharedSpellSlots(): boolean {
    return this.spellSlots().length > 0;
  }

  hasSlotBasedSpells(): boolean {
    return (this.character()?.spells ?? []).some(
      (spell) => spell.isPrepared && !spell.isCantrip && !spell.resourceId?.trim(),
    );
  }

  canUseSpell(spell: SpellData): boolean {
    if (!spell.isPrepared) return false;
    const resource = this.spellResource(spell);
    if (resource) {
      return resource.isUnlimited || resource.current >= this.spellResourceCost(spell, resource);
    }
    if (spell.resourceId) return false;
    if (spell.isCantrip) return true;
    return this.hasSharedSpellSlots()
      ? this.getAvailableSlotLevels(spell).length > 0
      : this.getSpellUsesRemaining(spell) > 0;
  }

  spellResource(spell: SpellData): CharacterResource | null {
    const resourceId = spell.resourceId?.trim();
    if (!resourceId) return null;
    return this.characterResources().find((resource) => resource.id === resourceId) ?? null;
  }

  spellResourceCost(spell: SpellData, resource: CharacterResource): number {
    return Math.max(1, Math.floor(spell.resourceCost ?? resource.spendAmount ?? 1));
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
    if (!character || !this.canUseSpell(spell) || this.spellState().pendingId !== null) return;
    const resource = this.spellResource(spell);
    if (resource) {
      this.useSpellWithResource(spell, resource);
      return;
    }
    const slotLevel =
      !spell.isCantrip && this.hasSharedSpellSlots() ? this.getSelectedSlotLevel(spell) : undefined;
    void this.performSpellUse(
      spell.id,
      () => this.characterService.usePlayerSpell(character.name, spell.id, slotLevel),
      { spellName: spell.name, isCantrip: spell.isCantrip, slotLevel: slotLevel ?? null },
      'spellUnavailable',
      'spellUse',
      'PlayerComponent.useSpell',
    );
  }

  closeSpellUseConfirmation(): void {
    this.spellState.update((state) => ({ ...state, confirmation: null }));
  }

  useSpellWithResource(spell: SpellData, resource: CharacterResource): void {
    const character = this.character();
    const amount = this.spellResourceCost(spell, resource);
    if (
      !character ||
      !spell.isPrepared ||
      this.spellState().pendingId !== null ||
      (!resource.isUnlimited && resource.current < amount)
    )
      return;
    void this.performSpellUse(
      spell.id,
      () => this.characterService.useResource(character.name, resource.id, amount),
      { spellName: spell.name, isCantrip: false, slotLevel: null, resourceName: resource.name },
      'freeUseSpent',
      'freeUse',
      'PlayerComponent.useSpellWithResource',
    );
  }

  private async performSpellUse(
    spellId: string,
    request: () => Promise<boolean>,
    confirmation: SpellUseConfirmation,
    unavailableKey: string,
    failureKey: string,
    logContext: string,
  ): Promise<void> {
    const version = this.sessionVersion;
    this.spellState.update((state) => ({
      ...state,
      pendingId: spellId,
      error: null,
      confirmation: null,
    }));
    try {
      const success = await request();
      if (version !== this.sessionVersion) return;
      this.spellState.update((state) => ({
        ...state,
        confirmation: success ? confirmation : null,
        error: success ? null : this.i18n.translate('player.error.' + unavailableKey),
      }));
    } catch (error) {
      this.logger.error(logContext, error);
      if (version !== this.sessionVersion) return;
      this.spellState.update((state) => ({
        ...state,
        error: this.i18n.translate('player.error.' + failureKey),
      }));
    } finally {
      if (version === this.sessionVersion) {
        this.spellState.update((state) => ({ ...state, pendingId: null }));
      }
    }
  }

  canUseResource(resource: CharacterResource): boolean {
    const amount = resource.spendMode === 'variable' ? 1 : (resource.spendAmount ?? 1);
    return (
      resource.isUnlimited === true || (isPositiveInteger(amount) && resource.current >= amount)
    );
  }

  useResource(resourceId: string, requestedAmount?: number): void {
    const character = this.character();
    const resource = this.characterResources().find((candidate) => candidate.id === resourceId);
    if (!character || !resource || !this.canUseResource(resource) || this.resourceState().pendingId)
      return;
    if (this.activeResourceEffect(resource.id)) return;

    if (resource.spendMode === 'variable' && requestedAmount === undefined) {
      this.resourceState.update((state) => ({
        ...state,
        selected: resource,
        amount: 1,
        error: null,
      }));
      return;
    }
    const amount = resource.isUnlimited
      ? 1
      : resource.spendMode === 'variable'
        ? (requestedAmount ?? 1)
        : (resource.spendAmount ?? 1);
    if (!isPositiveInteger(amount) || (!resource.isUnlimited && amount > resource.current)) return;
    this.performResourceUse(character.name, resource, amount);
  }

  confirmResourceUse(): void {
    const resource = this.resourceState().selected;
    if (!resource) return;
    const amount = this.resourceState().amount;
    this.closeResourceUseDialog();
    this.useResource(resource.id, amount);
  }

  closeResourceUseDialog(): void {
    this.resourceState.update((state) => ({ ...state, selected: null, amount: 1 }));
  }

  setResourceUseAmount(event: Event): void {
    const amount = clampInteger(
      (event.target as HTMLInputElement).value,
      1,
      this.resourceState().selected?.current ?? 1,
    );
    this.resourceState.update((state) => ({ ...state, amount }));
  }

  activeResourceEffect(resourceId: string): ActiveStatusEffect | null {
    return this.playerActiveEffects().find((effect) => effect.resourceId === resourceId) ?? null;
  }

  extendResourceEffect(resourceId: string): void {
    const version = this.sessionVersion;
    const combatant = this.playerCombatant();
    const resource = this.characterResources().find((candidate) => candidate.id === resourceId);
    const effect = this.activeResourceEffect(resourceId);
    if (!combatant || !resource?.activeEffect || !effect || this.resourceState().updatingEffectId)
      return;
    const duration = this.resourceEffectDuration(resource);
    if (!duration) return;
    this.resourceState.update((state) => ({
      ...state,
      updatingEffectId: resourceId,
      effectConfirmation: null,
    }));
    this.battleService
      .refreshStatusEffect(combatant.id, effect.id, duration.triggers, duration.label)
      .then((success) => {
        if (version !== this.sessionVersion) return;
        if (!success) {
          this.resourceState.update((state) => ({
            ...state,
            error: this.i18n.translate('player.error.extendResource'),
          }));
          return;
        }
        this.resourceState.update((state) => ({
          ...state,
          effectConfirmation: {
            resourceName: resource.name,
            durationLabel: duration.label,
            icon: resource.icon ?? resource.activeEffect?.icon ?? '⚡',
          },
        }));
      })
      .catch((error: unknown) => {
        this.logger.error('PlayerComponent.extendResourceEffect', error);
        if (version !== this.sessionVersion) return;
        this.resourceState.update((state) => ({
          ...state,
          error: this.i18n.translate('player.error.extendResource'),
        }));
      })
      .finally(() => {
        if (version === this.sessionVersion)
          this.resourceState.update((state) => ({ ...state, updatingEffectId: null }));
      });
  }

  closeResourceEffectConfirmation(): void {
    this.resourceState.update((state) => ({ ...state, effectConfirmation: null }));
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
    const version = this.sessionVersion;
    this.resourceState.update((state) => ({
      ...state,
      pendingId: resource.id,
      error: null,
      confirmation: null,
    }));
    this.characterService
      .useResource(playerName, resource.id, amount)
      .then(async (success) => {
        if (version !== this.sessionVersion) return;
        if (!success) {
          this.resourceState.update((state) => ({
            ...state,
            error: this.i18n.translate('player.error.resourceDepleted'),
          }));
          return;
        }
        const activated = await this.activateResourceEffect(resource);
        if (version !== this.sessionVersion) return;
        this.resourceState.update((state) => ({
          ...state,
          confirmation: {
            resourceName: resource.name,
            icon: resource.icon ?? resource.activeEffect?.icon ?? '⚡',
            isUnlimited: resource.isUnlimited === true,
            remaining: resource.isUnlimited ? 0 : Math.max(0, resource.current - amount),
            max: resource.max,
            spent: resource.isUnlimited ? 0 : amount,
            activated,
          },
        }));
      })
      .catch((error: unknown) => {
        this.logger.error('PlayerComponent.useResource', error);
        if (version !== this.sessionVersion) return;
        this.resourceState.update((state) => ({
          ...state,
          error: this.i18n.translate('player.error.spendResource'),
        }));
      })
      .finally(() => {
        if (version === this.sessionVersion)
          this.resourceState.update((state) => ({ ...state, pendingId: null }));
      });
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
      label:
        effect.duration === 'until-next-turn-end'
          ? this.i18n.translate('player.duration.untilNextTurnEnd')
          : this.i18n.translate('player.duration.rounds', { rounds }),
    };
  }

  closeResourceUseConfirmation(): void {
    this.resourceState.update((state) => ({ ...state, confirmation: null }));
  }

  selectEnemy(enemyId: string): void {
    this.attackState.update((state) => ({ ...state, enemyId: enemyId }));
  }

  isSelectableEnemy(combatant: Combatant): boolean {
    return combatant.type === COMBATANT_TYPE.ENEMY && combatant.status === COMBATANT_STATUS.ALIVE;
  }

  selectCombatant(combatant: Combatant): void {
    if (!this.isSelectableEnemy(combatant)) return;
    this.selectEnemy(combatant.id);
  }

  clearSelection(): void {
    this.attackState.update((state) => ({ ...state, enemyId: null, damage: 0, mode: 'main' }));
  }

  onWeaponChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.attackState.update((state) => ({ ...state, weaponIndex: +select.value }));
  }

  setAttackMode(mode: 'main' | 'additional'): void {
    this.attackState.update((state) => ({ ...state, mode: mode }));
  }

  onDamageInput(event: Event): void {
    const damage = clampInteger((event.target as HTMLInputElement).value, 0);
    this.attackState.update((state) => ({ ...state, damage }));
  }

  useItem(item: InventoryItem): void {
    if (this.inventoryState().pending) return;
    this.inventoryState.update((state) => ({
      ...state,
      error: null,
      selected: item,
      quantity: 1,
      mode: 'use',
      open: true,
    }));
  }

  confirmAndUseItem(): void {
    const version = this.sessionVersion;
    const item = this.inventoryState().selected;
    const char = this.character();
    if (!item || this.inventoryState().mode !== 'use' || !char || this.inventoryState().pending)
      return;
    const quantity = this.inventoryState().quantity;
    this.inventoryState.update((state) => ({ ...state, pending: true, error: null }));

    this.inventoryService
      .consumeItem(char.name, item.id, quantity)
      .then((success) => {
        if (version !== this.sessionVersion) return;
        // A completed request must not reopen a dialog after logout or navigation away.
        if (this.character()?.name !== char.name || this.inventoryState().selected?.id !== item.id)
          return;
        if (!success) {
          this.inventoryState.update((state) => ({
            ...state,
            error: this.i18n.translate('player.error.notEnoughItems'),
          }));
          return;
        }
        this.closeUseModal();
        this.inventoryState.update((state) => ({
          ...state,
          confirmation: { itemName: item.name, icon: item.icon || '🎒', quantity },
        }));
      })
      .catch((error: unknown) => {
        this.logger.error('PlayerComponent.confirmAndUseItem', error);
        if (version !== this.sessionVersion) return;
        this.inventoryState.update((state) => ({
          ...state,
          error: this.i18n.translate('player.items.useError'),
        }));
      })
      .finally(() => {
        if (version === this.sessionVersion)
          this.inventoryState.update((state) => ({ ...state, pending: false }));
      });
  }

  closeItemUseConfirmation(): void {
    this.itemConfirmationDialog()?.nativeElement.close();
    this.inventoryState.update((state) => ({ ...state, confirmation: null }));
  }

  closeUseModal(): void {
    this.inventoryState.update((state) => ({
      ...state,
      open: false,
      error: null,
      selected: null,
      quantity: 1,
      mode: 'use',
    }));
  }

  examineItem(item: InventoryItem): void {
    this.inventoryState.update((state) => ({
      ...state,
      selected: item,
      mode: 'examine',
      open: true,
    }));
  }

  onUseQuantityInput(event: Event): void {
    const quantity = clampInteger(
      (event.target as HTMLInputElement).value,
      1,
      this.inventoryState().selected?.quantity ?? 1,
    );
    this.inventoryState.update((state) => ({ ...state, quantity }));
  }

  attack(): void {
    const version = this.sessionVersion;
    if (!this.canAttack()) return;
    const enemy = this.selectedEnemy();
    if (!enemy) return;
    this.battleService
      .takeDamage(enemy.id, this.attackState().damage)
      .then(() => {
        if (version !== this.sessionVersion) return;
        this.attackState.update((state) => ({ ...state, damage: 0, mode: 'additional' }));
      })
      .catch((error: unknown) => this.logger.error('PlayerComponent.attack', error));
  }
}
