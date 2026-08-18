import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { BATTLE_STATUS, BattleStatus } from '../../core/constants/battle-status.constants';
import { COMBATANT_STATUS, COMBATANT_TYPE } from '../../core/constants/combatant.constants';
import { Combatant } from '../../core/models/combatant.model';
import { BattleService } from '../../core/services/battle.service';
import { StorySlide } from '../../core/models/story-presentation.model';
import { StoryPresentationService } from '../../core/services/story-presentation.service';
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
  let combatants: ReturnType<typeof signal<Combatant[]>>;
  let presentationMode: ReturnType<typeof signal<'battle' | 'story'>>;
  let activeStorySlide: ReturnType<typeof signal<StorySlide | null>>;

  beforeEach(() => {
    status = signal<BattleStatus>(BATTLE_STATUS.PREPARATION);
    enemies = signal<Combatant[]>([]);
    current = signal<Combatant | null>(null);
    round = signal(1);
    combatants = signal<Combatant[]>([]);
    presentationMode = signal<'battle' | 'story'>('battle');
    activeStorySlide = signal<StorySlide | null>(null);

    TestBed.configureTestingModule({
      imports: [DisplayComponent],
      providers: [
        {
          provide: BattleService,
          useValue: {
            battleStatus: status,
            aliveEnemies: enemies,
            sortedCombatants: combatants,
            currentCombatant: current,
            currentRound: round,
          },
        },
        {
          provide: StoryPresentationService,
          useValue: {
            mode: presentationMode,
            activeSlide: activeStorySlide,
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

  it('renders immersive enemy effects and a compact player effect roster', () => {
    const burningEnemy: Combatant = {
      ...enemy,
      activeEffects: [{ id: 'fire', type: 'burning', appliedAt: 1 }],
    };
    const frightenedPlayer: Combatant = {
      ...enemy,
      id: 'player_Aria',
      name: 'Aria',
      type: COMBATANT_TYPE.PLAYER,
      playerName: 'Aria',
      currentHp: 0,
      status: COMBATANT_STATUS.DOWNED,
      deathSaves: { successes: 1, failures: 1 },
      activeEffects: [{ id: 'fear', type: 'frightened', appliedAt: 1 }],
    };
    status.set(BATTLE_STATUS.BATTLE);
    enemies.set([burningEnemy]);
    combatants.set([frightenedPlayer, burningEnemy]);

    const fixture = TestBed.createComponent(DisplayComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.bestiary-card')).toHaveClass(
      'bestiary-card--burning',
    );
    expect(fixture.nativeElement.querySelector('.bestiary-card__active-effects')).toHaveTextContent(
      'Горение',
    );
    expect(fixture.nativeElement.querySelector('.arena__party-effects')).toHaveTextContent('Aria');
    expect(fixture.nativeElement.querySelector('.arena__party-effects')).toHaveTextContent('Страх');
    expect(fixture.nativeElement.querySelector('.arena__party-effects')).toHaveTextContent(
      'Без сознания',
    );
  });

  it('shows a local story image fullscreen while preserving battle state in the background', () => {
    status.set(BATTLE_STATUS.BATTLE);
    enemies.set([enemy]);
    presentationMode.set('story');
    activeStorySlide.set({
      id: 'tavern',
      name: 'Таверна.webp',
      blob: new Blob(['tavern']),
      objectUrl: 'blob:tavern',
    });

    const fixture = TestBed.createComponent(DisplayComponent);
    fixture.detectChanges();

    const image = fixture.nativeElement.querySelector<HTMLImageElement>('.story-display__image');
    const backdrop = fixture.nativeElement.querySelector<HTMLImageElement>(
      '.story-display__backdrop img',
    );
    expect(image).not.toBeNull();
    expect(image?.getAttribute('src')).toBe('blob:tavern');
    expect(image?.getAttribute('alt')).toBe('Таверна.webp');
    expect(backdrop?.getAttribute('src')).toBe('blob:tavern');
    expect(backdrop?.getAttribute('alt')).toBe('');
    expect(fixture.nativeElement.querySelector('.arena')).toBeNull();

    presentationMode.set('battle');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.story-display')).toBeNull();
    expect(fixture.nativeElement.querySelector('.arena')).not.toBeNull();
  });
});
