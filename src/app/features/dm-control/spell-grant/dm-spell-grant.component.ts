import {
  ChangeDetectionStrategy,
  Component,
  WritableSignal,
  inject,
  signal,
} from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { KeyValuePipe } from '@angular/common';
import { SpellData } from '../../../core/models/combatant.model';
import { BattleService } from '../../../core/services/battle.service';
import { CharacterService } from '../../../core/services/character.service';
import { LoggerService } from '../../../core/services/logger.service';

@Component({
  selector: 'app-dm-spell-grant',
  standalone: true,
  imports: [KeyValuePipe, TranslocoPipe],
  templateUrl: './dm-spell-grant.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DmSpellGrantComponent {
  private readonly battleService = inject(BattleService);
  private readonly characterService = inject(CharacterService);
  private readonly logger = inject(LoggerService);

  readonly players = this.battleService.playersInBattle;
  readonly selectedPlayerId = signal<string | null>(null);
  readonly spellName = signal('');
  readonly spellLevel = signal(0);
  readonly school = signal('');
  readonly description = signal('');
  readonly damageFormula = signal('');
  readonly damageType = signal('');
  readonly saving = signal(false);
  onPlayerChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.selectedPlayerId.set(select.value || null);
  }

  onLevelInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const level = Number(input.value);
    this.spellLevel.set(Math.min(9, Math.max(0, Number.isFinite(level) ? Math.floor(level) : 0)));
  }

  setText(target: WritableSignal<string>, event: Event): void {
    const input = event.target as HTMLInputElement;
    target.set(input.value);
  }

  giveSpell(): void {
    const playerId = this.selectedPlayerId();
    const name = this.spellName().trim();
    if (!playerId || !name || this.saving()) return;

    const level = this.spellLevel();
    const spell: SpellData = {
      id: `spell-${crypto.randomUUID()}`,
      name,
      level,
      school: this.school().trim(),
      description: this.description().trim(),
      damageFormula: this.damageFormula().trim(),
      damageType: this.damageType().trim(),
      isCantrip: level === 0,
      isPrepared: true,
    };

    this.saving.set(true);
    this.characterService
      .updatePlayerSpells(playerId.replace('player_', ''), spell)
      .then(() => this.resetForm())
      .catch((error: unknown) => this.logger.error('DmSpellGrantComponent.giveSpell', error))
      .finally(() => this.saving.set(false));
  }

  restoreSpells(): void {
    const playerId = this.selectedPlayerId();
    if (!playerId) return;
    this.characterService
      .restorePlayerSpells(playerId.replace('player_', ''))
      .catch((error: unknown) => this.logger.error('DmSpellGrantComponent.restoreSpells', error));
  }

  resetForm(): void {
    this.selectedPlayerId.set(null);
    this.spellName.set('');
    this.spellLevel.set(0);
    this.school.set('');
    this.description.set('');
    this.damageFormula.set('');
    this.damageType.set('');
  }
}
