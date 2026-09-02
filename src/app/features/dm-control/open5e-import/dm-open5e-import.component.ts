import {
  ChangeDetectionStrategy,
  Component,
  WritableSignal,
  computed,
  inject,
  signal,
} from '@angular/core';
import { Observable, firstValueFrom } from 'rxjs';
import {
  EnemyAbility,
  EnemyAction,
  Open5eContentKind,
  Open5eCreature,
  Open5eEntry,
  Open5eSpell,
  Open5eWeapon,
  SpellData,
  SpellTemplate,
} from '../../../core/models';
import { BattleService } from '../../../core/services/battle.service';
import { CharacterService } from '../../../core/services/character.service';
import { EnemyActionLibraryService } from '../scene-library/enemy-action-library.service';
import { LoggerService } from '../../../core/services/logger.service';
import { Open5eService } from './open5e.service';
import { SceneLibraryService } from '../scene-library/scene-library.service';
import { SpellLibraryService } from './spell-library.service';

@Component({
  selector: 'app-dm-open5e-import',
  standalone: true,
  templateUrl: './dm-open5e-import.component.html',
  styleUrl: './dm-open5e-import.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DmOpen5eImportComponent {
  private readonly open5e = inject(Open5eService);
  private readonly spellLibrary = inject(SpellLibraryService);
  private readonly actionLibrary = inject(EnemyActionLibraryService);
  private readonly sceneLibrary = inject(SceneLibraryService);
  private readonly characterService = inject(CharacterService);
  private readonly battle = inject(BattleService);
  private readonly logger = inject(LoggerService);
  private searchSequence = 0;

  readonly kind = signal<Open5eContentKind>('spell');
  readonly query = signal('');
  readonly documentKey = signal('srd-2024');
  readonly results = signal<Open5eEntry[]>([]);
  readonly selected = signal<Open5eEntry | null>(null);
  readonly searching = signal(false);
  readonly saving = signal(false);
  readonly giving = signal(false);
  readonly feedback = signal<string | null>(null);
  readonly error = signal<string | null>(null);

  readonly spellName = signal('');
  readonly spellSchool = signal('');
  readonly spellDescription = signal('');
  readonly spellHigherLevel = signal('');
  readonly spellDamageFormula = signal('');
  readonly spellDamageType = signal('');
  readonly spellCastingTime = signal('');
  readonly spellRange = signal('');
  readonly spellDuration = signal('');
  readonly spellComponents = signal('');

  readonly weaponName = signal('');
  readonly weaponDescription = signal('');
  readonly weaponToHit = signal('');
  readonly weaponDamage = signal('');
  readonly weaponDamageType = signal('');
  readonly weaponFullText = signal('');

  readonly creatureName = signal('');
  readonly creatureSubtype = signal('');
  readonly creatureMaxHp = signal(1);
  readonly creatureAc = signal(10);
  readonly creatureResistances = signal('');
  readonly creatureActions = signal<EnemyAction[]>([]);
  readonly creatureAbilities = signal<EnemyAbility[]>([]);

  readonly selectedPlayerId = signal('');
  readonly selectedSavedSpellId = signal('');

  readonly savedSpells = this.spellLibrary.spells;
  readonly savedActions = this.actionLibrary.actions;
  readonly savedCreatures = this.sceneLibrary.creatures;
  readonly players = computed(() =>
    Object.values(this.battle.playersInBattle()).sort((a, b) => a.name.localeCompare(b.name)),
  );
  readonly selectedSpell = computed(() => {
    const entry = this.selected();
    return entry?.kind === 'spell' ? entry : null;
  });
  readonly selectedWeapon = computed(() => {
    const entry = this.selected();
    return entry?.kind === 'weapon' ? entry : null;
  });
  readonly selectedCreature = computed(() => {
    const entry = this.selected();
    return entry?.kind === 'creature' ? entry : null;
  });
  readonly canSave = computed(() => {
    const entry = this.selected();
    if (entry?.kind === 'spell') return this.spellName().trim().length > 0;
    if (entry?.kind === 'weapon') return this.weaponName().trim().length > 0;
    if (entry?.kind === 'creature') {
      return this.creatureName().trim().length > 0 && this.creatureMaxHp() > 0 && this.creatureAc() > 0;
    }
    return false;
  });

  setKind(kind: Open5eContentKind): void {
    if (this.kind() === kind) return;
    this.searchSequence += 1;
    this.searching.set(false);
    this.kind.set(kind);
    this.results.set([]);
    this.selected.set(null);
    this.clearMessages();
  }

  setText(target: WritableSignal<string>, event: Event): void {
    target.set((event.target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement).value);
  }

  setQuery(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
  }

  setDocument(event: Event): void {
    this.documentKey.set((event.target as HTMLSelectElement).value);
  }

  setPlayer(event: Event): void {
    this.selectedPlayerId.set((event.target as HTMLSelectElement).value);
  }

  setSavedSpell(event: Event): void {
    this.selectedSavedSpellId.set((event.target as HTMLSelectElement).value);
  }

  onSearchKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') this.search();
  }

  search(): void {
    const query = this.query().trim();
    if (!query || this.searching()) return;
    const sequence = ++this.searchSequence;
    this.searching.set(true);
    this.clearMessages();
    const request: Observable<Open5eEntry[]> = this.kind() === 'spell'
      ? this.open5e.searchSpells(query, this.documentKey())
      : this.kind() === 'creature'
        ? this.open5e.searchCreatures(query, this.documentKey())
        : this.open5e.searchWeapons(query, this.documentKey());
    firstValueFrom(request)
      .then((results) => {
        if (sequence !== this.searchSequence) return;
        this.results.set(results);
        this.selected.set(null);
        if (results.length === 0) this.feedback.set('Ничего не найдено. Попробуйте английское название или другой источник.');
      })
      .catch((error: unknown) => {
        if (sequence !== this.searchSequence) return;
        this.logger.error('DmOpen5eImportComponent.search', error);
        this.error.set('Open5e сейчас недоступен или заблокировал запрос. Сохранённая библиотека продолжает работать.');
      })
      .finally(() => {
        if (sequence === this.searchSequence) this.searching.set(false);
      });
  }

  selectEntry(entry: Open5eEntry): void {
    this.selected.set(entry);
    this.clearMessages();
    if (entry.kind === 'spell') this.loadSpellDraft(entry);
    if (entry.kind === 'weapon') this.loadWeaponDraft(entry);
    if (entry.kind === 'creature') this.loadCreatureDraft(entry);
  }

  updateCreatureAction(index: number, field: keyof EnemyAction, event: Event): void {
    const value = (event.target as HTMLInputElement | HTMLTextAreaElement).value;
    this.creatureActions.update((actions) =>
      actions.map((action, actionIndex) => actionIndex === index ? { ...action, [field]: value } : action),
    );
  }

  updateCreatureAbility(index: number, field: keyof EnemyAbility, event: Event): void {
    const value = (event.target as HTMLInputElement | HTMLTextAreaElement).value;
    this.creatureAbilities.update((abilities) =>
      abilities.map((ability, abilityIndex) => abilityIndex === index ? { ...ability, [field]: value } : ability),
    );
  }

  onCreatureNumber(target: WritableSignal<number>, event: Event, fallback: number): void {
    const value = Number((event.target as HTMLInputElement).value);
    target.set(Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback);
  }

  saveSelected(): void {
    const entry = this.selected();
    if (!entry || !this.canSave() || this.saving()) return;
    this.saving.set(true);
    this.clearMessages();
    const save = entry.kind === 'spell'
      ? this.saveSpell(entry)
      : entry.kind === 'weapon'
        ? this.saveWeapon(entry)
        : this.saveCreature(entry);
    save
      .then(() => {
        const label = entry.kind === 'spell' ? 'Заклинание' : entry.kind === 'weapon' ? 'Оружие' : 'Существо';
        this.feedback.set(`${label} сохранено в личную библиотеку.`);
      })
      .catch((error: unknown) => {
        this.logger.error('DmOpen5eImportComponent.saveSelected', error);
        this.error.set('Не удалось сохранить перевод. Поля не очищены — можно повторить попытку.');
      })
      .finally(() => this.saving.set(false));
  }

  saveAndGiveSpell(): void {
    const spell = this.selectedSpell();
    if (!spell || !this.selectedPlayerId() || this.saving() || this.giving()) return;
    this.saving.set(true);
    this.giving.set(true);
    this.clearMessages();
    this.saveSpell(spell)
      .then((template) => this.giveTemplate(template))
      .then(() => this.feedback.set('Заклинание сохранено и выдано игроку.'))
      .catch((error: unknown) => {
        this.logger.error('DmOpen5eImportComponent.saveAndGiveSpell', error);
        this.error.set('Не удалось сохранить или выдать заклинание. Перевод не потерян.');
      })
      .finally(() => {
        this.saving.set(false);
        this.giving.set(false);
      });
  }

  giveSavedSpell(): void {
    const template = this.savedSpells().find((spell) => spell.id === this.selectedSavedSpellId());
    if (!template || !this.selectedPlayerId() || this.giving()) return;
    this.giving.set(true);
    this.clearMessages();
    this.giveTemplate(template)
      .then(() => this.feedback.set(`${template.name} выдано игроку.`))
      .catch((error: unknown) => {
        this.logger.error('DmOpen5eImportComponent.giveSavedSpell', error);
        this.error.set('Не удалось выдать заклинание. Выбор сохранён.');
      })
      .finally(() => this.giving.set(false));
  }

  resultMeta(entry: Open5eEntry): string {
    if (entry.kind === 'spell') return entry.level === 0 ? 'Заговор' : `${entry.level} уровень`;
    if (entry.kind === 'creature') return `ПО ${entry.challengeRating} · ${entry.maxHp} HP · КД ${entry.ac}`;
    return `${entry.damageFormula || 'без кости'} ${entry.damageType}`.trim();
  }

  isSaved(entry: Open5eEntry): boolean {
    const id = this.libraryId(entry.kind, entry.document.key, entry.key);
    if (entry.kind === 'spell') return this.savedSpells().some((spell) => spell.id === id);
    if (entry.kind === 'weapon') return this.savedActions().some((action) => action.id === id);
    return this.savedCreatures().some((creature) => creature.id === id);
  }

  private loadSpellDraft(spell: Open5eSpell): void {
    this.spellName.set(spell.name);
    this.spellSchool.set(spell.school);
    this.spellDescription.set(spell.description);
    this.spellHigherLevel.set(spell.higherLevel);
    this.spellDamageFormula.set(spell.damageFormula);
    this.spellDamageType.set(spell.damageTypes.join(', '));
    this.spellCastingTime.set(spell.castingTime);
    this.spellRange.set(spell.range);
    this.spellDuration.set(spell.duration);
    this.spellComponents.set(spell.components);
  }

  private loadWeaponDraft(weapon: Open5eWeapon): void {
    this.weaponName.set(weapon.name);
    this.weaponDescription.set(weapon.properties.join(', '));
    this.weaponToHit.set('');
    this.weaponDamage.set(weapon.damageFormula);
    this.weaponDamageType.set(weapon.damageType);
    this.weaponFullText.set([weapon.description, weapon.range ? `Range: ${weapon.range}` : ''].filter(Boolean).join('\n'));
  }

  private loadCreatureDraft(creature: Open5eCreature): void {
    this.creatureName.set(creature.name);
    this.creatureSubtype.set(creature.subtype);
    this.creatureMaxHp.set(creature.maxHp);
    this.creatureAc.set(creature.ac);
    this.creatureResistances.set(creature.resistances.join(', '));
    this.creatureActions.set(creature.actions.map((action) => ({ ...action })));
    this.creatureAbilities.set(creature.abilities.map((ability) => ({ ...ability })));
  }

  private async saveSpell(spell: Open5eSpell): Promise<SpellTemplate> {
    const template: SpellTemplate = {
      id: this.libraryId('spell', spell.document.key, spell.key),
      name: this.spellName().trim(),
      level: spell.level,
      school: this.spellSchool().trim(),
      description: this.spellDescription().trim(),
      higherLevel: this.spellHigherLevel().trim(),
      damageFormula: this.spellDamageFormula().trim(),
      damageType: this.spellDamageType().trim(),
      castingTime: this.spellCastingTime().trim(),
      range: this.spellRange().trim(),
      duration: this.spellDuration().trim(),
      components: this.spellComponents().trim(),
      isCantrip: spell.level === 0,
      isRitual: spell.ritual,
      requiresConcentration: spell.concentration,
      source: this.source(spell),
      createdAt: 0,
      lastUpdated: 0,
    };
    await this.spellLibrary.saveSpell(template);
    return template;
  }

  private saveWeapon(weapon: Open5eWeapon): Promise<string> {
    return this.actionLibrary.saveAction({
      id: this.libraryId('weapon', weapon.document.key, weapon.key),
      name: this.weaponName().trim(),
      description: this.weaponDescription().trim(),
      toHit: this.weaponToHit().trim(),
      damage: this.weaponDamage().trim(),
      damageType: this.weaponDamageType().trim(),
      fullText: this.weaponFullText().trim(),
      source: this.source(weapon),
    });
  }

  private saveCreature(creature: Open5eCreature): Promise<string> {
    return this.sceneLibrary.saveCreature({
      id: this.libraryId('creature', creature.document.key, creature.key),
      name: this.creatureName().trim(),
      subtype: this.creatureSubtype().trim(),
      maxHp: this.creatureMaxHp(),
      ac: this.creatureAc(),
      actions: this.creatureActions().map((action) => ({ ...action })),
      abilities: this.creatureAbilities().map((ability) => ({ ...ability })),
      resistances: this.parseList(this.creatureResistances()),
      statuses: [],
      source: this.source(creature),
    });
  }

  private giveTemplate(template: SpellTemplate): Promise<void> {
    const player = this.players().find((candidate) => candidate.id === this.selectedPlayerId());
    if (!player?.playerName) return Promise.reject(new Error('Player is not selected'));
    const spell: SpellData = {
      id: `spell-${crypto.randomUUID()}`,
      librarySpellId: template.id,
      sourceKey: template.source.key,
      name: template.name,
      level: template.level,
      school: template.school,
      description: template.description,
      higherLevel: template.higherLevel,
      damageFormula: template.damageFormula,
      damageType: template.damageType,
      castingTime: template.castingTime,
      range: template.range,
      duration: template.duration,
      components: template.components,
      isRitual: template.isRitual,
      requiresConcentration: template.requiresConcentration,
      isCantrip: template.isCantrip,
      isPrepared: true,
    };
    return this.characterService.updatePlayerSpells(player.playerName, spell);
  }

  private source(entry: Open5eEntry) {
    return {
      provider: 'open5e' as const,
      key: entry.key,
      documentKey: entry.document.key,
      documentName: entry.document.name,
      permalink: entry.document.permalink,
      originalName: entry.name,
      originalDescription: entry.description,
      importedAt: Date.now(),
    };
  }

  private libraryId(kind: Open5eContentKind, documentKey: string, key: string): string {
    const safe = `${documentKey}_${key}`.replace(/[^a-zA-Z0-9_-]+/g, '_').replace(/^_+|_+$/g, '');
    return `${kind}_open5e_${safe || 'unknown'}`;
  }

  private parseList(value: string): string[] {
    return value.split(/[,;]/).map((item) => item.trim()).filter(Boolean);
  }

  private clearMessages(): void {
    this.feedback.set(null);
    this.error.set(null);
  }
}
