import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { UpperCasePipe } from '@angular/common';
import { BattleService } from '../../core/services/battle.service';
import { EnemyInput } from '../../core/models';
import { HpBarComponent } from '../../shared/ui/hp-bar/hp-bar.component';

const DEFAULT_ENEMY_TYPE = 'goblin';
const DEFAULT_MAX_HP = 10;
const DEFAULT_AC = 12;

const WEAPON_NAMES = [
  'Shortsword',
  'Longsword',
  'Greatsword',
  'Dagger',
  'Rapier',
  'Scimitar',
  'Battleaxe',
  'Greataxe',
  'Maul',
  'Warhammer',
  'Spear',
  'Javelin',
  'Longbow',
  'Shortbow',
  'Crossbow',
  'Handaxe',
  'Light Hammer',
  'Mace',
  'Morningstar',
  'Flail',
];

const DAMAGE_TYPES = [
  'slashing',
  'piercing',
  'bludgeoning',
  'fire',
  'cold',
  'lightning',
  'acid',
  'poison',
  'psychic',
  'necrotic',
  'radiant',
  'thunder',
  'force',
];

const ACTION_DESCRIPTIONS = [
  'Melee Attack',
  'Ranged Attack',
  'Reach Attack',
  'Multiattack',
  'Special Attack',
  'Area Attack',
  'Bite',
  'Claw',
  'Tail Slap',
];

const STATUSES = [
  'poisoned',
  'charmed',
  'paralyzed',
  'frightened',
  'restrained',
  'blinded',
  'deafened',
  'stunned',
  'burning',
  'frozen',
  'shocked',
  'exhausted',
  'grappled',
  'incapacitated',
  'prone',
];

const RESISTANCES = [
  'fire',
  'cold',
  'lightning',
  'acid',
  'poison',
  'necrotic',
  'psychic',
  'radiant',
  'thunder',
  'force',
];

function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickRandomItems<T>(arr: T[], maxCount: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, randomInt(0, Math.min(maxCount, shuffled.length)));
}

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

  private generateRandomEnemyData() {
    const actionCount = randomInt(1, 3);
    const actions = [];
    for (let i = 0; i < actionCount; i++) {
      const weapon = randomItem(WEAPON_NAMES);
      const damageType = randomItem(DAMAGE_TYPES);
      const description = randomItem(ACTION_DESCRIPTIONS);
      const toHit = randomInt(2, 6);
      const diceCount = randomInt(1, 3);
      const diceSides = [4, 6, 8, 10, 12][randomInt(0, 4)];
      const damageBonus = randomInt(0, 4);
      const damageFormula = `${diceCount}d${diceSides} + ${damageBonus}`;

      actions.push({
        name: weapon,
        description: description,
        toHit: `+${toHit}`,
        damage: damageFormula,
        damageType: damageType,
        fullText: `${weapon}. ${description}: +${toHit} to hit, reach 5 ft., one target. Hit ${damageFormula} ${damageType} damage.`,
      });
    }

    const statuses = pickRandomItems(STATUSES, 2);

    const resistances = pickRandomItems(RESISTANCES, 2);

    return { actions, statuses, resistances };
  }

  addEnemy(): void {
    const name = this.newEnemyName().trim();
    if (!name || this.newEnemyMaxHp() <= 0) return;

    const randomData = this.generateRandomEnemyData();

    const input: EnemyInput = {
      name,
      type: this.newEnemyType(),
      maxHp: this.newEnemyMaxHp(),
      ac: this.newEnemyAc(),
      actions: randomData.actions,
      statuses: randomData.statuses,
      resistances: randomData.resistances,
    };

    this.battleService
      .addEnemy(input)
      .then(() => this.resetEnemyForm())
      .catch((error: unknown) => console.error('Error adding enemy:', error));
  }

  randomizeAllEnemies(): void {
    const enemies = this.enemiesList();
    if (enemies.length === 0) return;

    const updates = enemies.map((enemy) => {
      const randomData = this.generateRandomEnemyData();
      return this.battleService.updateEnemy(enemy.id, {
        actions: randomData.actions,
        statuses: randomData.statuses,
        resistances: randomData.resistances,
      });
    });

    Promise.all(updates)
      .then(() => console.log('All enemies randomized!'))
      .catch((err) => console.error('Error randomizing enemies:', err));
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
