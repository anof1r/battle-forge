import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { BATTLE_STATUS, BattleStatus } from '../../core/constants/battle-status.constants';
import { COMBATANT_STATUS, COMBATANT_TYPE } from '../../core/constants/combatant.constants';
import { Combatant } from '../../core/models/combatant.model';
import { BattleService } from '../../core/services/battle.service';
import { DisplayComponent } from './display.component';

describe('DisplayComponent', () => {
  const enemy: Combatant = {
    id: 'goblin-1',
    type: COMBATANT_TYPE.ENEMY,
    subtype: 'goblin',
    name: 'Goblin',
    initiative: 15,
    ac: 13,
    maxHp: 12,
    currentHp: 8,
    status: COMBATANT_STATUS.ALIVE,
    actions: [],
    abilities: [{ name: 'Nimble Escape', description: 'Can Hide as a bonus action.' }],
  };

  let status: ReturnType<typeof signal<BattleStatus>>;
  let enemies: ReturnType<typeof signal<Combatant[]>>;
  let current: ReturnType<typeof signal<Combatant | null>>;
  let round: ReturnType<typeof signal<number>>;

  beforeEach(() => {
    status = signal<BattleStatus>(BATTLE_STATUS.PREPARATION);
    enemies = signal<Combatant[]>([]);
    current = signal<Combatant | null>(null);
    round = signal(1);

    TestBed.configureTestingModule({
      imports: [DisplayComponent],
      providers: [
        {
          provide: BattleService,
          useValue: {
            battleStatus: status,
            aliveEnemies: enemies,
            currentCombatant: current,
            currentRound: round,
          },
        },
      ],
    });
  });

  it('renders the correct waiting message for each non-battle state', () => {
    const fixture = TestBed.createComponent(DisplayComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement).toHaveTextContent('Awaiting the Dungeon Master');

    status.set(BATTLE_STATUS.INITIATIVE);
    fixture.detectChanges();
    expect(fixture.nativeElement).toHaveTextContent('Rolling initiative');

    status.set(BATTLE_STATUS.ENDED);
    fixture.detectChanges();
    expect(fixture.nativeElement).toHaveTextContent('The battle has ended');
  });

  it('renders live round, enemy count, HP and current-turn state during battle', () => {
    status.set(BATTLE_STATUS.BATTLE);
    enemies.set([enemy]);
    current.set(enemy);
    round.set(3);

    const fixture = TestBed.createComponent(DisplayComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.stage__intro')).toBeNull();
    expect(fixture.nativeElement.querySelector('.arena')).not.toBeNull();
    expect(fixture.nativeElement).toHaveTextContent('Round');
    expect(fixture.nativeElement).toHaveTextContent('3');
    expect(fixture.nativeElement).toHaveTextContent('Goblin');
    expect(fixture.nativeElement.querySelector('.seal--hp .seal__value')).toHaveTextContent('8');
    expect(fixture.nativeElement.querySelector('.seal--hp .seal__label')).toHaveTextContent(
      '/ 12 HP',
    );
    expect(fixture.nativeElement.querySelector('.bestiary-card')).toHaveClass(
      'bestiary-card--active',
    );
    expect(fixture.nativeElement.querySelector('.bestiary-card__abilities')).toHaveTextContent(
      'Nimble Escape',
    );
  });
});
