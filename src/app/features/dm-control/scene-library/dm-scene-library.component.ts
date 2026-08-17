import {
  ChangeDetectionStrategy,
  Component,
  WritableSignal,
  computed,
  inject,
  signal,
} from '@angular/core';
import { BattleService } from '../../../core/services/battle.service';
import { LoggerService } from '../../../core/services/logger.service';
import { SceneLibraryService } from '../../../core/services/scene-library.service';
import {
  CreatureTemplate,
  EnemyAbility,
  EnemyAction,
  ScenePreset,
  ScenePresetEntry,
} from '../../../core/models';

@Component({
  selector: 'app-dm-scene-library',
  standalone: true,
  templateUrl: './dm-scene-library.component.html',
  styleUrl: './dm-scene-library.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DmSceneLibraryComponent {
  private readonly library = inject(SceneLibraryService);
  private readonly battle = inject(BattleService);
  private readonly logger = inject(LoggerService);

  readonly creatures = this.library.creatures;
  readonly scenes = this.library.scenes;

  readonly creatureId = signal<string | null>(null);
  readonly creatureName = signal('');
  readonly creatureSubtype = signal('');
  readonly creatureMaxHp = signal(10);
  readonly creatureAc = signal(12);
  readonly creatureResistances = signal('');
  readonly creatureStatuses = signal('');
  readonly creatureActions = signal<EnemyAction[]>([]);
  readonly creatureAbilities = signal<EnemyAbility[]>([]);

  readonly actionName = signal('');
  readonly actionToHit = signal('');
  readonly actionDamage = signal('');
  readonly actionDamageType = signal('');
  readonly actionDescription = signal('');
  readonly actionFullText = signal('');
  readonly abilityName = signal('');
  readonly abilityDescription = signal('');

  readonly sceneId = signal<string | null>(null);
  readonly sceneName = signal('');
  readonly sceneDescription = signal('');
  readonly sceneEntries = signal<ScenePresetEntry[]>([]);
  readonly selectedTemplateId = signal('');
  readonly selectedQuantity = signal(1);

  readonly savingCreature = signal(false);
  readonly savingScene = signal(false);
  readonly launchingSceneId = signal<string | null>(null);
  readonly feedback = signal<string | null>(null);
  readonly error = signal<string | null>(null);

  readonly canSaveCreature = computed(
    () => this.creatureName().trim().length > 0 && this.creatureMaxHp() > 0 && this.creatureAc() > 0,
  );
  readonly canSaveScene = computed(
    () => this.sceneName().trim().length > 0 && this.sceneEntries().length > 0,
  );

  setText(target: WritableSignal<string>, event: Event): void {
    target.set((event.target as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement).value);
  }

  onCreatureMaxHpInput(event: Event): void {
    this.creatureMaxHp.set(this.positiveInteger(event, 1));
  }

  onCreatureAcInput(event: Event): void {
    this.creatureAc.set(this.positiveInteger(event, 1));
  }

  onQuantityInput(event: Event): void {
    this.selectedQuantity.set(this.positiveInteger(event, 1));
  }

  addAction(): void {
    const name = this.actionName().trim();
    if (!name) return;
    this.creatureActions.update((actions) => [
      ...actions,
      {
        name,
        toHit: this.actionToHit().trim(),
        damage: this.actionDamage().trim(),
        damageType: this.actionDamageType().trim(),
        description: this.actionDescription().trim(),
        fullText: this.actionFullText().trim(),
      },
    ]);
    this.actionName.set('');
    this.actionToHit.set('');
    this.actionDamage.set('');
    this.actionDamageType.set('');
    this.actionDescription.set('');
    this.actionFullText.set('');
  }

  removeAction(index: number): void {
    this.creatureActions.update((actions) => actions.filter((_, actionIndex) => actionIndex !== index));
  }

  addAbility(): void {
    const name = this.abilityName().trim();
    const description = this.abilityDescription().trim();
    if (!name || !description) return;
    this.creatureAbilities.update((abilities) => [...abilities, { name, description }]);
    this.abilityName.set('');
    this.abilityDescription.set('');
  }

  removeAbility(index: number): void {
    this.creatureAbilities.update((abilities) =>
      abilities.filter((_, abilityIndex) => abilityIndex !== index),
    );
  }

  saveCreature(): void {
    if (!this.canSaveCreature() || this.savingCreature()) return;
    this.savingCreature.set(true);
    this.clearMessages();
    this.library
      .saveCreature({
        id: this.creatureId() ?? undefined,
        name: this.creatureName().trim(),
        subtype: this.creatureSubtype().trim(),
        maxHp: this.creatureMaxHp(),
        ac: this.creatureAc(),
        actions: this.creatureActions(),
        abilities: this.creatureAbilities(),
        resistances: this.parseList(this.creatureResistances()),
        statuses: this.parseList(this.creatureStatuses()),
      })
      .then(() => {
        this.feedback.set(this.creatureId() ? 'Шаблон существа обновлён.' : 'Существо сохранено в библиотеку.');
        this.resetCreatureEditor();
      })
      .catch((error: unknown) => {
        this.logger.error('DmSceneLibraryComponent.saveCreature', error);
        this.error.set('Не удалось сохранить существо. Данные формы сохранены.');
      })
      .finally(() => this.savingCreature.set(false));
  }

  editCreature(creature: CreatureTemplate): void {
    this.creatureId.set(creature.id);
    this.creatureName.set(creature.name);
    this.creatureSubtype.set(creature.subtype);
    this.creatureMaxHp.set(creature.maxHp);
    this.creatureAc.set(creature.ac);
    this.creatureActions.set([...(creature.actions ?? [])]);
    this.creatureAbilities.set([...(creature.abilities ?? [])]);
    this.creatureResistances.set((creature.resistances ?? []).join(', '));
    this.creatureStatuses.set((creature.statuses ?? []).join(', '));
    this.clearMessages();
  }

  deleteCreature(creature: CreatureTemplate): void {
    if (!confirm(`Удалить шаблон «${creature.name}»?`)) return;
    this.clearMessages();
    this.library
      .deleteCreature(creature.id)
      .then((deleted) => {
        if (!deleted) {
          this.error.set('Существо используется в сохранённой сцене. Сначала удалите его из набора.');
          return;
        }
        if (this.creatureId() === creature.id) this.resetCreatureEditor();
        this.feedback.set('Шаблон существа удалён.');
      })
      .catch((error: unknown) => {
        this.logger.error('DmSceneLibraryComponent.deleteCreature', error);
        this.error.set('Не удалось удалить существо.');
      });
  }

  addCreatureToBattle(creature: CreatureTemplate): void {
    this.clearMessages();
    this.battle
      .addCreatureStacks([{ template: creature, quantity: 1 }])
      .then(() => this.feedback.set(`${creature.name} добавлен в текущий бой.`))
      .catch((error: unknown) => {
        this.logger.error('DmSceneLibraryComponent.addCreatureToBattle', error);
        this.error.set('Не удалось добавить существо в бой.');
      });
  }

  addSceneEntry(): void {
    const templateId = this.selectedTemplateId();
    if (!templateId || !this.creatures().some((creature) => creature.id === templateId)) return;
    const quantity = this.selectedQuantity();
    this.sceneEntries.update((entries) => {
      const existing = entries.find((entry) => entry.templateId === templateId);
      return existing
        ? entries.map((entry) =>
            entry.templateId === templateId
              ? { ...entry, quantity: entry.quantity + quantity }
              : entry,
          )
        : [...entries, { templateId, quantity }];
    });
    this.selectedTemplateId.set('');
    this.selectedQuantity.set(1);
  }

  removeSceneEntry(templateId: string): void {
    this.sceneEntries.update((entries) => entries.filter((entry) => entry.templateId !== templateId));
  }

  saveScene(): void {
    if (!this.canSaveScene() || this.savingScene()) return;
    this.savingScene.set(true);
    this.clearMessages();
    this.library
      .saveScene({
        id: this.sceneId() ?? undefined,
        name: this.sceneName().trim(),
        description: this.sceneDescription().trim(),
        entries: this.sceneEntries(),
      })
      .then(() => {
        this.feedback.set(this.sceneId() ? 'Набор сцены обновлён.' : 'Набор сцены сохранён.');
        this.resetSceneEditor();
      })
      .catch((error: unknown) => {
        this.logger.error('DmSceneLibraryComponent.saveScene', error);
        this.error.set('Не удалось сохранить набор. Данные формы сохранены.');
      })
      .finally(() => this.savingScene.set(false));
  }

  editScene(scene: ScenePreset): void {
    this.sceneId.set(scene.id);
    this.sceneName.set(scene.name);
    this.sceneDescription.set(scene.description);
    this.sceneEntries.set(scene.entries.map((entry) => ({ ...entry })));
    this.clearMessages();
  }

  launchScene(scene: ScenePreset): void {
    if (this.launchingSceneId()) return;
    const stacks = this.library.resolveScene(scene.id);
    if (!stacks || stacks.length !== scene.entries.length) {
      this.error.set('В наборе отсутствует один или несколько шаблонов существ.');
      return;
    }
    this.launchingSceneId.set(scene.id);
    this.clearMessages();
    this.battle
      .addCreatureStacks(stacks)
      .then((ids) => this.feedback.set(`Сцена «${scene.name}» добавлена: ${ids.length} существ.`))
      .catch((error: unknown) => {
        this.logger.error('DmSceneLibraryComponent.launchScene', error);
        this.error.set('Не удалось добавить сцену в бой.');
      })
      .finally(() => this.launchingSceneId.set(null));
  }

  deleteScene(scene: ScenePreset): void {
    if (!confirm(`Удалить набор «${scene.name}»?`)) return;
    this.clearMessages();
    this.library
      .deleteScene(scene.id)
      .then(() => {
        if (this.sceneId() === scene.id) this.resetSceneEditor();
        this.feedback.set('Набор сцены удалён.');
      })
      .catch((error: unknown) => {
        this.logger.error('DmSceneLibraryComponent.deleteScene', error);
        this.error.set('Не удалось удалить набор сцены.');
      });
  }

  creatureNameFor(templateId: string): string {
    return this.creatures().find((creature) => creature.id === templateId)?.name ?? 'Шаблон удалён';
  }

  sceneCreatureCount(scene: ScenePreset): number {
    return scene.entries.reduce((total, entry) => total + entry.quantity, 0);
  }

  resetCreatureEditor(): void {
    this.creatureId.set(null);
    this.creatureName.set('');
    this.creatureSubtype.set('');
    this.creatureMaxHp.set(10);
    this.creatureAc.set(12);
    this.creatureResistances.set('');
    this.creatureStatuses.set('');
    this.creatureActions.set([]);
    this.creatureAbilities.set([]);
  }

  resetSceneEditor(): void {
    this.sceneId.set(null);
    this.sceneName.set('');
    this.sceneDescription.set('');
    this.sceneEntries.set([]);
    this.selectedTemplateId.set('');
    this.selectedQuantity.set(1);
  }

  private positiveInteger(event: Event, fallback: number): number {
    const input = event.target as HTMLInputElement;
    const value = Number(input.value);
    return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
  }

  private parseList(value: string): string[] {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  private clearMessages(): void {
    this.feedback.set(null);
    this.error.set(null);
  }
}
