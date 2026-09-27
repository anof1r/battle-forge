import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import {
  CHARACTER_SKILL_DEFINITIONS,
  CHARACTER_STAT_KEYS,
} from '../../../core/constants/character-skill.constants';
import {
  CharacterSavingThrow,
  CharacterStats,
  ParsedCharacter,
} from '../../../core/models/character.model';
import {
  CharacterSkill,
  CharacterSkillProficiency,
  CharacterStatKey,
} from '../../../core/models/character-skill.model';
import { BattleService } from '../../../core/services/battle.service';
import {
  CharacterNameConflictError,
  CharacterService,
  InvalidCharacterNameError,
} from '../../../core/services/character.service';
import { LoggerService } from '../../../core/services/logger.service';
import { getCharacterProficiencyBonus } from '../../../core/utils/weapon-attack.util';
import { AvatarComponent } from '../../../shared/ui/avatar/avatar.component';

type SkillProficiencyDraft = CharacterSkillProficiency;
type CharacterCoreNumber =
  | 'level'
  | 'maxHp'
  | 'currentHp'
  | 'temporaryHp'
  | 'ac'
  | 'speed'
  | 'proficiencyBonus';
type CharacterTextField = 'name' | 'class' | 'race';

interface CharacterSkillDraft {
  id: string;
  name: string;
  baseStat: CharacterStatKey;
  proficiency: SkillProficiencyDraft;
  modifier: number;
}

interface CharacterEditorDraft {
  name: string;
  class: string;
  race: string;
  level: number;
  stats: CharacterStats;
  maxHp: number;
  currentHp: number;
  temporaryHp: number;
  ac: number;
  speed: number;
  proficiencyBonus: number;
  savingThrows: CharacterSavingThrow[];
  skills: CharacterSkillDraft[];
}

@Component({
  selector: 'app-dm-character-editor',
  standalone: true,
  imports: [AvatarComponent, TranslocoPipe],
  templateUrl: './dm-character-editor.component.html',
  styleUrl: './dm-character-editor.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DmCharacterEditorComponent {
  private readonly characters = inject(CharacterService);
  private readonly battle = inject(BattleService);
  private readonly logger = inject(LoggerService);
  private readonly i18n = inject(TranslocoService);

  readonly statKeys = CHARACTER_STAT_KEYS;
  readonly players = signal<ParsedCharacter[]>([]);
  readonly selectedPlayerName = signal<string | null>(null);
  readonly draft = signal<CharacterEditorDraft | null>(null);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly feedback = signal<string | null>(null);
  readonly error = signal<string | null>(null);

  readonly selectedPlayer = computed(() => {
    const name = this.selectedPlayerName();
    return this.players().find((player) => player.name === name) ?? null;
  });

  constructor() {
    void this.loadPlayers();
  }

  async refreshPlayers(): Promise<void> {
    await this.loadPlayers(this.selectedPlayerName());
  }

  selectPlayer(name: string): void {
    const player = this.players().find((candidate) => candidate.name === name);
    if (!player) return;
    this.selectedPlayerName.set(player.name);
    this.draft.set(this.createDraft(player));
    this.clearMessages();
  }

  resetDraft(): void {
    const player = this.selectedPlayer();
    if (!player) return;
    this.draft.set(this.createDraft(player));
    this.clearMessages();
  }

  setText(field: CharacterTextField, event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.draft.update((draft) => draft ? { ...draft, [field]: value } : null);
  }

  setCoreNumber(field: CharacterCoreNumber, event: Event): void {
    const raw = Number((event.target as HTMLInputElement).value);
    const minimum = field === 'level' || field === 'maxHp' ? 1 : 0;
    const value = Number.isFinite(raw) ? Math.max(minimum, Math.trunc(raw)) : minimum;
    this.draft.update((draft) => draft ? { ...draft, [field]: value } : null);
  }

  setStat(stat: CharacterStatKey, event: Event): void {
    const raw = Number((event.target as HTMLInputElement).value);
    const value = Number.isFinite(raw) ? Math.max(1, Math.trunc(raw)) : 10;
    this.draft.update((draft) => draft
      ? { ...draft, stats: { ...draft.stats, [stat]: value } }
      : null,
    );
  }

  setSavingThrowProficiency(stat: CharacterStatKey, event: Event): void {
    const proficient = (event.target as HTMLInputElement).checked;
    this.draft.update((draft) => draft
      ? {
          ...draft,
          savingThrows: draft.savingThrows.map((save) =>
            save.stat === stat ? { ...save, proficient } : save,
          ),
        }
      : null,
    );
  }

  setSavingThrowModifier(stat: CharacterStatKey, event: Event): void {
    const modifier = this.signedInteger(event);
    this.draft.update((draft) => draft
      ? {
          ...draft,
          savingThrows: draft.savingThrows.map((save) =>
            save.stat === stat ? { ...save, modifier } : save,
          ),
        }
      : null,
    );
  }

  setSkillProficiency(skillId: string, event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    const proficiency: SkillProficiencyDraft =
      value === 'proficient' || value === 'expertise' ? value : 'none';
    this.draft.update((draft) => draft
      ? {
          ...draft,
          skills: draft.skills.map((skill) =>
            skill.id === skillId ? { ...skill, proficiency } : skill,
          ),
        }
      : null,
    );
  }

  setSkillModifier(skillId: string, event: Event): void {
    const modifier = this.signedInteger(event);
    this.draft.update((draft) => draft
      ? {
          ...draft,
          skills: draft.skills.map((skill) =>
            skill.id === skillId ? { ...skill, modifier } : skill,
          ),
        }
      : null,
    );
  }

  recalculateDerivedBonuses(): void {
    this.draft.update((draft) => {
      if (!draft) return null;
      const abilityModifier = (stat: CharacterStatKey) =>
        Math.floor((draft.stats[stat] - 10) / 2);
      return {
        ...draft,
        savingThrows: draft.savingThrows.map((save) => ({
          ...save,
          modifier: abilityModifier(save.stat) + (save.proficient ? draft.proficiencyBonus : 0),
        })),
        skills: draft.skills.map((skill) => ({
          ...skill,
          modifier: abilityModifier(skill.baseStat)
            + (skill.proficiency === 'expertise'
              ? draft.proficiencyBonus * 2
              : skill.proficiency === 'proficient'
                ? draft.proficiencyBonus
                : 0),
        })),
      };
    });
    this.clearMessages();
  }

  async saveCharacter(): Promise<void> {
    const originalName = this.selectedPlayerName();
    const existing = this.selectedPlayer();
    const draft = this.draft();
    if (!originalName || !existing || !draft || this.saving()) return;
    if (!draft.name.trim()) {
      this.error.set(this.i18n.translate('characterEditor.error.nameRequired'));
      return;
    }

    const character: ParsedCharacter = {
      ...existing,
      name: draft.name.trim(),
      class: draft.class.trim(),
      race: draft.race.trim(),
      level: draft.level,
      stats: { ...draft.stats },
      maxHp: draft.maxHp,
      currentHp: Math.min(draft.currentHp, draft.maxHp),
      temporaryHp: draft.temporaryHp,
      ac: draft.ac,
      speed: draft.speed,
      proficiencyBonus: draft.proficiencyBonus,
      savingThrows: draft.savingThrows.map((save) => ({ ...save })),
      skills: draft.skills.map<CharacterSkill>((skill) => ({
        id: skill.id,
        name: skill.name,
        baseStat: skill.baseStat,
        proficiency: skill.proficiency,
        modifier: skill.modifier,
      })),
    };

    this.saving.set(true);
    this.clearMessages();
    try {
      const saved = await this.characters.updateCharacter(originalName, character);
      await this.battle.syncPlayerCharacter(originalName, saved);
      this.players.update((players) =>
        [...players.filter((player) => player.name !== originalName), saved]
          .sort((left, right) => left.name.localeCompare(right.name)),
      );
      this.selectedPlayerName.set(saved.name);
      this.draft.set(this.createDraft(saved));
      this.feedback.set(this.i18n.translate('characterEditor.feedback.saved', { name: saved.name }));
    } catch (error) {
      this.logger.error('DmCharacterEditorComponent.saveCharacter', error);
      this.error.set(
        this.i18n.translate(
          error instanceof CharacterNameConflictError
            ? 'characterEditor.error.nameTaken'
            : error instanceof InvalidCharacterNameError
              ? 'characterEditor.error.invalidName'
              : 'characterEditor.error.save',
        ),
      );
    } finally {
      this.saving.set(false);
    }
  }

  private async loadPlayers(preferredName: string | null = null): Promise<void> {
    this.loading.set(true);
    this.clearMessages();
    try {
      const players = (await this.characters.getAllPlayers())
        .sort((left, right) => left.name.localeCompare(right.name));
      this.players.set(players);
      const selected = players.find((player) => player.name === preferredName) ?? null;
      this.selectedPlayerName.set(selected?.name ?? null);
      this.draft.set(selected ? this.createDraft(selected) : null);
    } catch (error) {
      this.logger.error('DmCharacterEditorComponent.loadPlayers', error);
      this.error.set(this.i18n.translate('characterEditor.error.load'));
    } finally {
      this.loading.set(false);
    }
  }

  private createDraft(player: ParsedCharacter): CharacterEditorDraft {
    const proficiencyBonus = player.proficiencyBonus
      ?? getCharacterProficiencyBonus(player.level);
    const existingSkills = new Map((player.skills ?? []).map((skill) => [skill.id, skill]));
    const definitions = CHARACTER_SKILL_DEFINITIONS.map<CharacterSkillDraft>((definition) => {
      const skill = existingSkills.get(definition.id);
      existingSkills.delete(definition.id);
      return {
        id: definition.id,
        name: skill?.name ?? definition.name,
        baseStat: skill?.baseStat ?? definition.baseStat,
        proficiency: skill?.proficiency ?? 'none',
        modifier: skill?.modifier ?? Math.floor((player.stats[definition.baseStat] - 10) / 2),
      };
    });
    const customSkills = [...existingSkills.values()].map<CharacterSkillDraft>((skill) => ({
      ...skill,
      proficiency: skill.proficiency,
    }));
    const saves = new Map((player.savingThrows ?? []).map((save) => [save.stat, save]));

    return {
      name: player.name,
      class: player.class,
      race: player.race,
      level: player.level,
      stats: { ...player.stats },
      maxHp: player.maxHp,
      currentHp: player.currentHp,
      temporaryHp: player.temporaryHp ?? 0,
      ac: player.ac,
      speed: player.speed,
      proficiencyBonus,
      savingThrows: CHARACTER_STAT_KEYS.map((stat) => {
        const saved = saves.get(stat);
        return saved
          ? { ...saved }
          : { stat, proficient: false, modifier: Math.floor((player.stats[stat] - 10) / 2) };
      }),
      skills: [...definitions, ...customSkills],
    };
  }

  skillLabel(skill: CharacterSkillDraft): string {
    const key = `character.skills.${skill.id}`;
    const translated = this.i18n.translate(key);
    return translated === key ? skill.name : translated;
  }
  private signedInteger(event: Event): number {
    const value = Number((event.target as HTMLInputElement).value);
    return Number.isFinite(value) ? Math.trunc(value) : 0;
  }

  private clearMessages(): void {
    this.feedback.set(null);
    this.error.set(null);
  }
}
