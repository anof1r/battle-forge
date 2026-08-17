import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Observable, of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { COMBATANT_STATUS, COMBATANT_TYPE } from '../../core/constants/combatant.constants';
import { ParsedCharacter } from '../../core/models/character.model';
import { Combatant, SpellData } from '../../core/models/combatant.model';
import { InventoryItem } from '../../core/models/inventory-item.model';
import { BattleService } from '../../core/services/battle.service';
import { CharacterService } from '../../core/services/character.service';
import { CharacterParserService } from '../../core/services/characterParser.service';
import { InventoryService } from '../../core/services/inventory.service';
import { LoggerService } from '../../core/services/logger.service';
import { PlayerComponent } from './player.component';

describe('PlayerComponent', () => {
  let fixture: ComponentFixture<PlayerComponent>;
  let component: PlayerComponent;
  let characterService: {
    characterExists: ReturnType<typeof vi.fn>;
    loadCharacter: ReturnType<typeof vi.fn>;
    saveCharacter: ReturnType<typeof vi.fn>;
    subscribeToCharacter: ReturnType<typeof vi.fn>;
    usePlayerSpell: ReturnType<typeof vi.fn>;
  };
  let inventoryService: { consumeItem: ReturnType<typeof vi.fn> };
  let parser: {
    parseCharacter: ReturnType<typeof vi.fn>;
    getModifier: ReturnType<typeof vi.fn>;
  };
  let logger: { error: ReturnType<typeof vi.fn> };
  let battle: {
    aliveEnemies: ReturnType<typeof signal<Combatant[]>>;
    sortedCombatants: ReturnType<typeof signal<Combatant[]>>;
    currentCombatant: ReturnType<typeof signal<Combatant | null>>;
    currentRound: ReturnType<typeof signal<number>>;
    addPlayerToBattle: ReturnType<typeof vi.fn>;
    takeDamage: ReturnType<typeof vi.fn>;
  };

  const potion: InventoryItem = {
    id: 'potion-1',
    name: 'Potion',
    description: 'Restores HP',
    quantity: 3,
    isStackable: true,
    isConsumable: true,
    rarity: 'common',
  };

  const spell = (overrides: Partial<SpellData> = {}): SpellData => ({
    id: 'spell-1',
    name: 'Shield',
    level: 1,
    isCantrip: false,
    isPrepared: true,
    maxUses: 3,
    usesRemaining: 2,
    ...overrides,
  });

  const character = (overrides: Partial<ParsedCharacter> = {}): ParsedCharacter => ({
    name: 'Aria',
    class: 'Wizard',
    level: 5,
    race: 'Elf',
    stats: { str: 8, dex: 14, con: 12, int: 18, wis: 11, cha: 10 },
    maxHp: 30,
    currentHp: 24,
    ac: 13,
    speed: 30,
    weapons: [{ name: 'Dagger', damage: '1d4', damageType: 'piercing', ability: 'dex' }],
    inventory: [potion],
    abilities: [{ name: 'Darkvision', description: 'See in darkness' }],
    ...overrides,
  });

  const enemy: Combatant = {
    id: 'goblin-1',
    type: COMBATANT_TYPE.ENEMY,
    subtype: 'goblin',
    name: 'Goblin',
    initiative: 14,
    ac: 13,
    maxHp: 12,
    currentHp: 12,
    status: COMBATANT_STATUS.ALIVE,
  };

  const ally: Combatant = {
    id: 'player_Aria',
    type: COMBATANT_TYPE.PLAYER,
    name: 'Aria',
    initiative: 18,
    ac: 13,
    maxHp: 30,
    currentHp: 24,
    status: COMBATANT_STATUS.ALIVE,
    playerName: 'Aria',
    emoji: '🧙',
  };

  beforeEach(() => {
    characterService = {
      characterExists: vi.fn(),
      loadCharacter: vi.fn(),
      saveCharacter: vi.fn().mockResolvedValue(undefined),
      subscribeToCharacter: vi.fn().mockReturnValue(of(character())),
      usePlayerSpell: vi.fn().mockResolvedValue(true),
    };
    inventoryService = {
      consumeItem: vi.fn().mockResolvedValue(true),
    };
    parser = {
      parseCharacter: vi.fn(),
      getModifier: vi.fn((score: number) => Math.floor((score - 10) / 2)),
    };
    logger = { error: vi.fn() };
    battle = {
      aliveEnemies: signal<Combatant[]>([]),
      sortedCombatants: signal<Combatant[]>([]),
      currentCombatant: signal<Combatant | null>(null),
      currentRound: signal(1),
      addPlayerToBattle: vi.fn().mockResolvedValue(undefined),
      takeDamage: vi.fn().mockResolvedValue(undefined),
    };

    TestBed.configureTestingModule({
      imports: [PlayerComponent],
      providers: [
        { provide: BattleService, useValue: battle },
        { provide: CharacterService, useValue: characterService },
        { provide: InventoryService, useValue: inventoryService },
        { provide: CharacterParserService, useValue: parser },
        { provide: LoggerService, useValue: logger },
      ],
    });

    fixture = TestBed.createComponent(PlayerComponent);
    component = fixture.componentInstance;
  });

  it('rejects an empty login without calling the character service', () => {
    component.loginName.set('   ');

    component.login();

    expect(component.loginError()).toBe('Введите имя персонажа');
    expect(component.isLoggedIn()).toBe(false);
    expect(characterService.characterExists).not.toHaveBeenCalled();
  });

  it('offers JSON upload when a character does not exist', async () => {
    characterService.characterExists.mockResolvedValue(false);
    component.loginName.set('Missing');

    component.login();

    await vi.waitFor(() => expect(component.showUploadPrompt()).toBe(true));
    expect(component.loginError()).toBe('Персонаж не найден. Загрузите JSON-файл.');
    expect(characterService.loadCharacter).not.toHaveBeenCalled();
  });

  it('logs in, receives realtime character updates, and unsubscribes on logout', async () => {
    const initial = character();
    const updated = character({ currentHp: 10 });
    const unsubscribe = vi.fn();
    characterService.characterExists.mockResolvedValue(true);
    characterService.loadCharacter.mockResolvedValue(initial);
    characterService.subscribeToCharacter.mockReturnValue(
      new Observable<ParsedCharacter | null>((subscriber) => {
        subscriber.next(updated);
        return unsubscribe;
      }),
    );
    component.loginName.set('  Aria  ');

    component.login();

    await vi.waitFor(() => expect(component.isLoggedIn()).toBe(true));
    expect(characterService.characterExists).toHaveBeenCalledWith('Aria');
    expect(characterService.loadCharacter).toHaveBeenCalledWith('Aria');
    expect(characterService.subscribeToCharacter).toHaveBeenCalledWith('Aria');
    expect(battle.addPlayerToBattle).toHaveBeenCalledWith(initial, 0);
    expect(component.character()).toEqual(updated);

    component.selectedEnemyId.set(enemy.id);
    component.damageAmount.set(5);
    component.logout();

    expect(unsubscribe).toHaveBeenCalledOnce();
    expect(component.character()).toBeNull();
    expect(component.isLoggedIn()).toBe(false);
    expect(component.loginName()).toBe('');
    expect(component.selectedEnemyId()).toBeNull();
    expect(component.damageAmount()).toBe(0);
  });

  it('reports login failures through the logger and a user-safe message', async () => {
    const error = new Error('network unavailable');
    characterService.characterExists.mockRejectedValue(error);
    component.loginName.set('Aria');

    component.login();

    await vi.waitFor(() =>
      expect(component.loginError()).toBe('Ошибка при входе. Попробуйте позже.'),
    );
    expect(logger.error).toHaveBeenCalledWith('PlayerComponent.login', error);
  });

  it('parses, saves, and subscribes to a selected LSS JSON file', async () => {
    const parsed = character();
    parser.parseCharacter.mockReturnValue(parsed);

    class FakeFileReader {
      onload: ((event: { target: { result: string } }) => void) | null = null;

      readAsText(): void {
        this.onload?.({ target: { result: JSON.stringify({ data: {} }) } });
      }
    }
    vi.stubGlobal('FileReader', FakeFileReader);

    const file = new File(['{}'], 'aria.json', { type: 'application/json' });
    component.onFileSelected({
      target: { files: [file] },
    } as unknown as Event);

    await vi.waitFor(() => expect(characterService.saveCharacter).toHaveBeenCalledWith(parsed));
    expect(parser.parseCharacter).toHaveBeenCalledWith({ data: {} });
    expect(component.character()).toEqual(parsed);
    expect(component.isLoggedIn()).toBe(true);
    expect(component.loginName()).toBe('Aria');
    expect(characterService.subscribeToCharacter).toHaveBeenCalledWith('Aria');
    expect(battle.addPlayerToBattle).toHaveBeenCalledWith(parsed, 0);
  });

  it('keeps the player session active and logs when joining the battle fails', async () => {
    const joinError = new Error('room write failed');
    const savedCharacter = character();
    characterService.characterExists.mockResolvedValue(true);
    characterService.loadCharacter.mockResolvedValue(savedCharacter);
    battle.addPlayerToBattle.mockRejectedValue(joinError);
    component.loginName.set('Aria');

    component.login();

    await vi.waitFor(() =>
      expect(logger.error).toHaveBeenCalledWith('PlayerComponent.joinBattle', joinError),
    );
    expect(component.isLoggedIn()).toBe(true);
    expect(component.character()).not.toBeNull();
  });

  it('rejects malformed uploaded JSON and records the parsing error', () => {
    class FakeFileReader {
      onload: ((event: { target: { result: string } }) => void) | null = null;

      readAsText(): void {
        this.onload?.({ target: { result: '{broken' } });
      }
    }
    vi.stubGlobal('FileReader', FakeFileReader);

    component.onFileSelected({
      target: { files: [new File([''], 'broken.json') ] },
    } as unknown as Event);

    expect(component.error()).toBe(
      'Не удалось распарсить файл. Убедитесь, что это JSON с LSS.',
    );
    expect(logger.error).toHaveBeenCalledWith(
      'PlayerComponent.onFileSelected',
      expect.any(SyntaxError),
    );
    expect(characterService.saveCharacter).not.toHaveBeenCalled();
  });

  it('enables attacks only for a live selected enemy and clears damage after success', async () => {
    battle.aliveEnemies.set([enemy]);
    component.selectEnemy(enemy.id);
    component.damageAmount.set(6);

    expect(component.selectedEnemy()).toEqual(enemy);
    expect(component.canAttack()).toBe(true);

    component.attack();

    await vi.waitFor(() => expect(battle.takeDamage).toHaveBeenCalledWith(enemy.id, 6));
    await vi.waitFor(() => expect(component.damageAmount()).toBe(0));

    battle.aliveEnemies.set([]);
    expect(component.selectedEnemy()).toBeNull();
    expect(component.canAttack()).toBe(false);
  });

  it('renders the arena safely before the first current turn is assigned', () => {
    component.character.set(character());
    component.isLoggedIn.set(true);
    component.activeTab.set('arena');
    battle.aliveEnemies.set([enemy]);
    battle.sortedCombatants.set([enemy]);
    battle.currentCombatant.set(null);

    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.player__arena-view')).not.toBeNull();
    expect(fixture.nativeElement).toHaveTextContent('Goblin');
    expect(fixture.nativeElement.querySelector('.player__combatant-card--current')).toBeNull();
  });

  it('renders every combatant in initiative order and makes only enemies selectable', () => {
    component.character.set(character());
    component.isLoggedIn.set(true);
    component.activeTab.set('arena');
    battle.aliveEnemies.set([enemy]);
    battle.sortedCombatants.set([ally, enemy]);
    battle.currentCombatant.set(ally);

    fixture.detectChanges();

    const cards = Array.from<HTMLElement>(
      fixture.nativeElement.querySelectorAll('.player__combatant-card'),
    );
    const names = Array.from<HTMLElement>(
      fixture.nativeElement.querySelectorAll('.player__combatant-name'),
    ).map((element) => element.textContent?.replace(/\s+/g, ' ').trim());

    expect(names).toEqual(['🧙 Aria', 'Goblin']);
    expect(cards).toHaveLength(2);
    expect(cards[0]).toHaveClass(
      'player__combatant-card--player',
      'player__combatant-card--current',
    );
    expect(cards[0]).not.toHaveAttribute('role');
    expect(cards[1]).toHaveClass('player__combatant-card--enemy');
    expect(cards[1]).toHaveAttribute('role', 'button');
    expect(fixture.nativeElement).toHaveTextContent('Участников: 2 · Врагов: 1');

    cards[0].click();
    expect(component.selectedEnemyId()).toBeNull();
    cards[1].click();
    expect(component.selectedEnemyId()).toBe(enemy.id);
  });

  it('keeps attack input intact and logs when damage persistence fails', async () => {
    const error = new Error('write failed');
    battle.aliveEnemies.set([enemy]);
    battle.takeDamage.mockRejectedValue(error);
    component.selectEnemy(enemy.id);
    component.damageAmount.set(4);

    component.attack();

    await vi.waitFor(() =>
      expect(logger.error).toHaveBeenCalledWith('PlayerComponent.attack', error),
    );
    expect(component.damageAmount()).toBe(4);
  });

  it('clamps item quantity and closes the modal after successful consumption', async () => {
    component.character.set(character());
    component.useItem(potion);
    expect(component.showUseModal()).toBe(true);
    expect(component.modalMode()).toBe('use');

    component.onUseQuantityInput({ target: { value: '20' } } as unknown as Event);
    expect(component.useQuantity()).toBe(3);

    component.confirmAndUseItem();

    await vi.waitFor(() =>
      expect(inventoryService.consumeItem).toHaveBeenCalledWith('Aria', 'potion-1', 3),
    );
    await vi.waitFor(() => expect(component.showUseModal()).toBe(false));
    expect(component.selectedItemForUse()).toBeNull();
    expect(component.useQuantity()).toBe(1);
  });

  it('supports examine mode and character presentation helpers', () => {
    component.character.set(character());

    component.examineItem(potion);
    expect(component.modalMode()).toBe('examine');
    expect(component.showUseModal()).toBe(true);

    expect(component.getStatValue('dex')).toBe(14);
    expect(component.getStatModString('dex')).toBe('+2');
    expect(component.getStatValue('unknown')).toBe(0);

    component.toggleAbility('Darkvision');
    expect(component.expandedAbility()).toBe('Darkvision');
    component.toggleAbility('Darkvision');
    expect(component.expandedAbility()).toBeNull();
  });

  it('renders unlimited cantrips and spends an available leveled spell use', async () => {
    const cantrip = spell({
      id: 'fire-bolt',
      name: 'Fire Bolt',
      level: 0,
      isCantrip: true,
      maxUses: undefined,
      usesRemaining: undefined,
    });
    const shield = spell();
    component.character.set(character({ spells: [cantrip, shield] }));
    component.isLoggedIn.set(true);

    fixture.detectChanges();

    const cards = Array.from<HTMLElement>(
      fixture.nativeElement.querySelectorAll('.player__spell-card'),
    );
    expect(cards[0]).toHaveTextContent('∞');
    expect(cards[1]).toHaveTextContent('2 / 3');

    const buttons = Array.from<HTMLButtonElement>(
      fixture.nativeElement.querySelectorAll('.player__spell-use-btn'),
    );
    buttons[1].click();

    await vi.waitFor(() =>
      expect(characterService.usePlayerSpell).toHaveBeenCalledWith('Aria', shield.id),
    );
    await vi.waitFor(() => expect(component.usingSpellId()).toBeNull());
  });

  it('disables unavailable spells and reports persistence failures', async () => {
    const exhausted = spell({ usesRemaining: 0 });
    const available = spell({ id: 'available' });
    component.character.set(character({ spells: [exhausted, available] }));
    component.isLoggedIn.set(true);
    characterService.usePlayerSpell.mockRejectedValue(new Error('write failed'));

    fixture.detectChanges();

    const buttons = Array.from<HTMLButtonElement>(
      fixture.nativeElement.querySelectorAll('.player__spell-use-btn'),
    );
    expect(buttons[0]).toBeDisabled();
    buttons[1].click();

    await vi.waitFor(() =>
      expect(logger.error).toHaveBeenCalledWith(
        'PlayerComponent.useSpell',
        expect.any(Error),
      ),
    );
    expect(component.spellUseError()).not.toBeNull();
  });
});
