import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { UpperCasePipe } from '@angular/common';
import { BattleService } from '../../core/services/battle.service';
import { EnemyInput } from '../../core/models';
import { HpBarComponent } from '../../shared/ui/hp-bar/hp-bar.component';

const DEFAULT_ENEMY_TYPE = 'goblin';
const DEFAULT_MAX_HP = 10;
const DEFAULT_AC = 12;

@Component({
  selector: 'app-dm-control',
  standalone: true,
  imports: [FormsModule, UpperCasePipe, HpBarComponent],
  templateUrl: './dm-control.component.html',
  styleUrl: './dm-control.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DmControlComponent {
  private readonly battleService = inject(BattleService);

  readonly newEnemyName = signal('');
  readonly newEnemyType = signal(DEFAULT_ENEMY_TYPE);
  readonly newEnemyMaxHp = signal(DEFAULT_MAX_HP);
  readonly newEnemyAc = signal(DEFAULT_AC);

  readonly damageTargetId = signal<string | null>(null);
  readonly damageAmount = signal(0);
  readonly damageMode = signal<'single' | 'all'>('single');

  readonly showAddForm = signal(true);
  readonly showInitiativeRolls = signal(false);
  readonly initiativeRolls = signal<Record<string, number>>({});

  readonly battleStatus = this.battleService.battleStatus;
  readonly aliveEnemies = this.battleService.aliveEnemies;
  readonly sortedByInitiative = this.battleService.sortedByInitiative;
  readonly currentRound = this.battleService.currentRound;
  readonly enemiesList = computed(() => Object.values(this.battleService.enemies()));

  readonly canApplyDamage = computed(
    () => this.damageAmount() > 0 && (this.damageMode() === 'all' || !!this.damageTargetId()),
  );

  addEnemy(): void {
    const name = this.newEnemyName().trim();
    if (!name || this.newEnemyMaxHp() <= 0) return;

    const input: EnemyInput = {
      name,
      type: this.newEnemyType(),
      maxHp: this.newEnemyMaxHp(),
      ac: this.newEnemyAc(),
    };

    this.battleService
      .addEnemy(input)
      .then(() => this.resetEnemyForm())
      .catch((error: unknown) => console.error('Error adding enemy:', error));
  }

  removeEnemy(id: string): void {
    this.battleService
      .removeEnemy(id)
      .catch((error: unknown) => console.error('Error removing enemy:', error));
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
      .catch((error: unknown) => console.error('Error setting initiative:', error));
  }

  confirmInitiative(): void {
    this.battleService
      .rollInitiative()
      .then(() => {
        this.showInitiativeRolls.set(false);
        this.showAddForm.set(false);
      })
      .catch((error: unknown) => console.error('Error confirming initiative:', error));
  }

  startBattle(): void {
    this.battleService.startBattle().catch((error: unknown) => {
      console.error('Error starting battle:', error);
    });
  }

  applyDamage(): void {
    if (!this.canApplyDamage()) return;

    const amount = this.damageAmount();
    const request =
      this.damageMode() === 'all'
        ? this.battleService.damageAll(amount)
        : this.battleService.takeDamage(this.damageTargetId()!, amount);

    request
      .then(() => this.resetDamagePanel())
      .catch((error: unknown) => console.error('Error applying damage:', error));
  }

  cancelDamage(): void {
    this.resetDamagePanel();
  }

  nextTurn(): void {
    this.battleService
      .nextTurn()
      .catch((error: unknown) => console.error('Error advancing turn:', error));
  }

  undoLastAction(): void {
    this.battleService
      .undoLastAction()
      .catch((error: unknown) => console.error('Error undoing action:', error));
  }

  resetScene(): void {
    if (!confirm('Are you sure you want to reset the entire battle?')) return;

    this.battleService
      .resetScene()
      .then(() => {
        this.showAddForm.set(true);
        this.showInitiativeRolls.set(false);
      })
      .catch((error: unknown) => console.error('Error resetting scene:', error));
  }

  private resetEnemyForm(): void {
    this.newEnemyName.set('');
    this.newEnemyType.set(DEFAULT_ENEMY_TYPE);
    this.newEnemyMaxHp.set(DEFAULT_MAX_HP);
    this.newEnemyAc.set(DEFAULT_AC);
  }

  private resetDamagePanel(): void {
    this.damageAmount.set(0);
    this.damageTargetId.set(null);
    this.damageMode.set('single');
  }
}
