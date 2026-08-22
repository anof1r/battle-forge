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
    useResource: ReturnType<typeof vi.fn>;
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
    addStatusEffect: ReturnType<typeof vi.fn>;
    removeStatusEffect: ReturnType<typeof vi.fn>;
    refreshStatusEffect: ReturnType<typeof vi.fn>;
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
    weapons: [{ name: 'Dagger', damage: '1d4 + ЛОВ', damageType: 'piercing' }],
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
    localStorage.clear();
    characterService = {
      characterExists: vi.fn(),
      loadCharacter: vi.fn(),
      saveCharacter: vi.fn().mockResolvedValue(undefined),
      subscribeToCharacter: vi.fn().mockReturnValue(of(character())),
      usePlayerSpell: vi.fn().mockResolvedValue(true),
      useResource: vi.fn().mockResolvedValue(true),
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
      addStatusEffect: vi.fn().mockResolvedValue(true),
      removeStatusEffect: vi.fn().mockResolvedValue(true),
      refreshStatusEffect: vi.fn().mockResolvedValue(true),
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

  it('shows the alpha version signature on the login screen', () => {
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.bf-build-signature')).toHaveTextContent(
      'ver 0.0.1 alpha by anof1r',
    );
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
    expect(localStorage.getItem('battle-forge:last-player-name')).toBe('Aria');

    component.selectedEnemyId.set(enemy.id);
    component.damageAmount.set(5);
    component.logout();

    expect(unsubscribe).toHaveBeenCalledOnce();
    expect(component.character()).toBeNull();
    expect(component.isLoggedIn()).toBe(false);
    expect(component.loginName()).toBe('');
    expect(component.selectedEnemyId()).toBeNull();
    expect(component.damageAmount()).toBe(0);

    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.player__login-btn--remembered')).toHaveTextContent(
      'Войти как Aria',
    );
  });

  it('restores the last player and offers a one-tap login', async () => {
    localStorage.setItem('battle-forge:last-player-name', 'Aria');
    characterService.characterExists.mockResolvedValue(true);
    characterService.loadCharacter.mockResolvedValue(character());
    const rememberedFixture = TestBed.createComponent(PlayerComponent);
    rememberedFixture.detectChanges();

    const quickLogin = rememberedFixture.nativeElement.querySelector(
      '.player__login-btn--remembered',
    ) as HTMLButtonElement;
    expect(quickLogin).toHaveTextContent('Войти как Aria');
    quickLogin.click();

    await vi.waitFor(() => expect(characterService.characterExists).toHaveBeenCalledWith('Aria'));
    await vi.waitFor(() => expect(rememberedFixture.componentInstance.isLoggedIn()).toBe(true));
    rememberedFixture.destroy();
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

  it('keeps login working when local storage is unavailable', async () => {
    const storageError = new DOMException('Storage blocked', 'SecurityError');
    vi.spyOn(Storage.prototype, 'setItem').mockImplementationOnce(() => {
      throw storageError;
    });
    characterService.characterExists.mockResolvedValue(true);
    characterService.loadCharacter.mockResolvedValue(character());
    component.loginName.set('Aria');

    component.login();

    await vi.waitFor(() => expect(component.isLoggedIn()).toBe(true));
    expect(logger.error).toHaveBeenCalledWith(
      'PlayerComponent.rememberSuccessfulLogin',
      storageError,
    );
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
    expect(localStorage.getItem('battle-forge:last-player-name')).toBe('Aria');
    expect(characterService.subscribeToCharacter).toHaveBeenCalledWith('Aria');
    expect(battle.addPlayerToBattle).toHaveBeenCalledWith(parsed, 0);
  });

  it('recovers trailing commas in an uploaded LSS wrapper', async () => {
    const parsed = character({ name: 'Квольхраф' });
    parser.parseCharacter.mockReturnValue(parsed);

    class FakeFileReader {
      onload: ((event: { target: { result: string } }) => void) | null = null;

      readAsText(): void {
        this.onload?.({ target: { result: '{"data":{},}' } });
      }
    }
    vi.stubGlobal('FileReader', FakeFileReader);

    component.onFileSelected({
      target: { files: [new File([''], 'kvollhraf.json')] },
    } as unknown as Event);

    await vi.waitFor(() => expect(characterService.saveCharacter).toHaveBeenCalledWith(parsed));
    expect(parser.parseCharacter).toHaveBeenCalledWith({ data: {} });
    expect(component.error()).toBeNull();
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

  it('accepts manually counted damage and allows an additional attack without a turn lock', async () => {
    battle.aliveEnemies.set([enemy]);
    component.selectEnemy(enemy.id);
    component.damageAmount.set(9);

    component.attack();

    await vi.waitFor(() => expect(battle.takeDamage).toHaveBeenNthCalledWith(1, enemy.id, 9));
    await vi.waitFor(() => expect(component.attackMode()).toBe('additional'));

    component.damageAmount.set(7);
    component.attack();

    await vi.waitFor(() => expect(battle.takeDamage).toHaveBeenNthCalledWith(2, enemy.id, 7));
    expect(component.selectedEnemyId()).toBe(enemy.id);
  });

  it('shows Russian characteristic abbreviations and the additional-attack tab', () => {
    component.character.set(character());
    component.isLoggedIn.set(true);
    battle.aliveEnemies.set([enemy]);
    component.activeTab.set('arena');
    component.selectEnemy(enemy.id);

    fixture.detectChanges();

    expect(fixture.nativeElement).toHaveTextContent('Доп. удар');
    expect(fixture.nativeElement).toHaveTextContent('Ограничения на количество атак нет');
  });

  it('shows the calculated attack bonus in the weapon list and arena attack form', () => {
    component.character.set(character());
    component.isLoggedIn.set(true);

    fixture.detectChanges();

    const weaponBonus = fixture.nativeElement.querySelector('.player__weapon-attack');
    expect(weaponBonus).toHaveTextContent('+5');

    component.activeTab.set('arena');
    battle.aliveEnemies.set([enemy]);
    battle.sortedCombatants.set([enemy]);
    component.selectEnemy(enemy.id);
    fixture.detectChanges();

    const arenaBonus = fixture.nativeElement.querySelector('.player__attack-bonus');
    expect(arenaBonus).toHaveTextContent('+5');
  });

  it('keeps current and maximum HP in one dedicated vitality value', () => {
    component.character.set(character({ currentHp: 120, maxHp: 120 }));
    component.isLoggedIn.set(true);

    fixture.detectChanges();

    const hp = fixture.nativeElement.querySelector('.player__vitality-value--hp');
    expect(hp).toHaveTextContent('120 / 120');
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

  it('shows the logged-in player active effects above both character tabs', () => {
    const affectedPlayer: Combatant = {
      ...ally,
      activeEffects: [
        { id: 'poison-1', type: 'poisoned', appliedAt: 1 },
        { id: 'fire-1', type: 'burning', appliedAt: 2 },
      ],
    };
    const affectedAlly: Combatant = {
      ...ally,
      id: 'player_Borin',
      name: 'Borin',
      playerName: 'Borin',
      activeEffects: [{ id: 'blessing-1', type: 'blessed', appliedAt: 3 }],
    };
    component.character.set(character());
    component.isLoggedIn.set(true);
    battle.sortedCombatants.set([affectedAlly, affectedPlayer, enemy]);

    fixture.detectChanges();

    const effects = fixture.nativeElement.querySelector(
      'bf-status-effect-list',
    ) as HTMLElement;
    expect(effects).toHaveTextContent('Текущие эффекты');
    expect(effects).toHaveTextContent('Отравление');
    expect(effects).toHaveTextContent('Горение');
    expect(effects).not.toHaveTextContent('Благословение');

    component.switchTab('arena');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('bf-status-effect-list')).not.toBeNull();
  });

  it('shows the logged-in player knockout and death save progress', () => {
    component.character.set(character({ currentHp: 0 }));
    component.isLoggedIn.set(true);
    battle.sortedCombatants.set([
      {
        ...ally,
        currentHp: 0,
        status: COMBATANT_STATUS.DOWNED,
        deathSaves: { successes: 1, failures: 2 },
      },
    ]);

    fixture.detectChanges();

    const lifeState = fixture.nativeElement.querySelector(
      'bf-combatant-life-state',
    ) as HTMLElement;
    expect(lifeState).toHaveTextContent('Без сознания');
    expect(lifeState).toHaveTextContent('✓ 1/3');
    expect(lifeState).toHaveTextContent('✕ 2/3');
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
      expect(characterService.usePlayerSpell).toHaveBeenCalledWith('Aria', shield.id, undefined),
    );
    await vi.waitFor(() => expect(component.usingSpellId()).toBeNull());
    expect(component.spellUseConfirmation()).toEqual({
      spellName: 'Shield',
      isCantrip: false,
      slotLevel: null,
    });

    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.spell-confirmation')).toHaveTextContent(
      'Списан заряд заклинания',
    );
  });

  it('collapses spell descriptions and highlights dice notation inside the text', () => {
    const description = 'Цель получает 2d6+3 урона огнём и ещё 1к4 урона в конце хода.';
    component.character.set(character({
      spells: [spell({ description, damageFormula: '2d6+3', damageType: 'огонь' })],
    }));
    component.isLoggedIn.set(true);

    fixture.detectChanges();

    const details = fixture.nativeElement.querySelector<HTMLDetailsElement>(
      '.player__spell-details',
    );
    const highlighted = Array.from<HTMLElement>(
      fixture.nativeElement.querySelectorAll('.player__spell-description .player__dice-notation'),
    );

    expect(details).not.toBeNull();
    expect(details?.open).toBe(false);
    expect(details?.querySelector('summary')).toHaveTextContent('Описание заклинания');
    expect(highlighted.map((element) => element.textContent)).toEqual(['2d6+3', '1к4']);
    expect(details?.querySelector('.player__spell-description')).toHaveTextContent(description);

    details?.querySelector<HTMLElement>('summary')?.click();
    expect(details?.open).toBe(true);
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
    expect(component.spellUseConfirmation()).toBeNull();
  });

  it('uses the selected shared slot and confirms its level in a modal', async () => {
    const shield = spell();
    component.character.set(character({
      spells: [shield],
      spellSlots: [
        { level: 1, current: 1, max: 2 },
        { level: 2, current: 1, max: 1, recovery: 'short-rest' },
      ],
    }));
    component.isLoggedIn.set(true);

    fixture.detectChanges();

    const slotSelect = fixture.nativeElement.querySelector<HTMLSelectElement>(
      '.player__slot-select',
    );
    expect(slotSelect).not.toBeNull();
    expect(slotSelect?.options).toHaveLength(2);
    if (slotSelect) {
      slotSelect.value = '2';
      slotSelect.dispatchEvent(new Event('change'));
    }

    expect(component.getAvailableSlotLevels(shield)).toEqual([1, 2]);
    expect(component.getSelectedSlotLevel(shield)).toBe(2);
    expect(component.canUseSpell(shield)).toBe(true);
    component.useSpell(shield);

    await vi.waitFor(() => expect(characterService.usePlayerSpell).toHaveBeenCalledWith(
      'Aria',
      shield.id,
      2,
    ));
    await vi.waitFor(() => expect(component.spellUseConfirmation()).toEqual({
      spellName: 'Shield',
      isCantrip: false,
      slotLevel: 2,
    }));

    fixture.detectChanges();
    const confirmation = fixture.nativeElement.querySelector<HTMLElement>('.spell-confirmation');
    expect(confirmation).toHaveTextContent('Shield');
    expect(confirmation).toHaveTextContent('Потрачена ячейка');
    expect(confirmation).toHaveTextContent('2 уровень');

    confirmation?.querySelector<HTMLButtonElement>('.spell-confirmation__close')?.click();
    expect(component.spellUseConfirmation()).toBeNull();
  });

  it('confirms that a cantrip does not spend a spell slot', async () => {
    const cantrip = spell({
      id: 'minor-illusion',
      name: 'Мелкие фокусы',
      level: 0,
      isCantrip: true,
      maxUses: undefined,
      usesRemaining: undefined,
    });
    component.character.set(character({
      spells: [cantrip],
      spellSlots: [{ level: 1, current: 2, max: 2 }],
    }));

    component.useSpell(cantrip);

    await vi.waitFor(() => expect(characterService.usePlayerSpell).toHaveBeenCalledWith(
      'Aria',
      cantrip.id,
      undefined,
    ));
    await vi.waitFor(() => expect(component.spellUseConfirmation()).toEqual({
      spellName: 'Мелкие фокусы',
      isCantrip: true,
      slotLevel: null,
    }));

    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.spell-confirmation')).toHaveTextContent(
      'Ячейка не расходуется',
    );
  });

  it('lets the player spend a configured class resource', async () => {
    component.character.set(character({
      resources: [{
        id: 'rage',
        name: 'Ярость',
        icon: '🔥',
        description: 'Преимущество к проверкам Силы.',
        current: 2,
        max: 2,
        recovery: 'long-rest',
      }],
    }));

    component.useResource('rage');

    await vi.waitFor(() => expect(characterService.useResource).toHaveBeenCalledWith('Aria', 'rage', 1));
    await vi.waitFor(() => expect(component.usingResourceId()).toBeNull());
    expect(component.resourceUseConfirmation()).toEqual({
      resourceName: 'Ярость',
      icon: '🔥',
      isUnlimited: false,
      remaining: 1,
      max: 2,
      spent: 1,
      activated: false,
    });

    fixture.detectChanges();
    const modal = fixture.nativeElement.querySelector('.resource-confirmation');
    expect(modal).toHaveTextContent('🔥');
    expect(modal).toHaveTextContent('Ресурс использован');
    expect(modal).toHaveTextContent('1 / 2');

    component.closeResourceUseConfirmation();
    expect(component.resourceUseConfirmation()).toBeNull();
  });

  it('renders and uses an unlimited resource without disabling it at zero', async () => {
    component.character.set(character({
      resources: [{
        id: 'sneak-attack',
        name: 'Скрытая атака',
        description: 'Один раз за ход при выполнении условий.',
        isUnlimited: true,
        current: 0,
        max: 0,
        recovery: 'manual',
      }],
    }));
    component.isLoggedIn.set(true);
    fixture.detectChanges();

    const card = fixture.nativeElement.querySelector('.player__resource-card--unlimited');
    expect(card).toHaveTextContent('∞');
    expect(card.querySelector('summary')).toHaveTextContent('Описание ресурса');
    expect(card.querySelector('button')).not.toBeDisabled();

    component.useResource('sneak-attack');

    await vi.waitFor(() => expect(characterService.useResource).toHaveBeenCalledWith(
      'Aria',
      'sneak-attack',
      1,
    ));
    await vi.waitFor(() => expect(component.resourceUseConfirmation()).toEqual({
      resourceName: 'Скрытая атака',
      icon: '⚡',
      isUnlimited: true,
      remaining: 0,
      max: 0,
      spent: 0,
      activated: false,
    }));

    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.resource-confirmation')).toHaveTextContent(
      '∞ Бесконечно',
    );
  });

  it('asks how many points to spend from a variable resource', async () => {
    component.character.set(character({
      resources: [{
        id: 'lay-on-hands',
        name: 'Наложение рук',
        icon: '✋',
        spendMode: 'variable',
        current: 5,
        max: 5,
        recovery: 'long-rest',
      }],
    }));

    component.useResource('lay-on-hands');

    expect(component.selectedResourceForUse()?.id).toBe('lay-on-hands');
    expect(characterService.useResource).not.toHaveBeenCalled();
    component.setResourceUseAmount({ target: { value: '4' } } as unknown as Event);
    component.confirmResourceUse();

    await vi.waitFor(() => expect(characterService.useResource).toHaveBeenCalledWith(
      'Aria',
      'lay-on-hands',
      4,
    ));
    await vi.waitFor(() => expect(component.resourceUseConfirmation()).toEqual({
      resourceName: 'Наложение рук',
      icon: '✋',
      isUnlimited: false,
      remaining: 1,
      max: 5,
      spent: 4,
      activated: false,
    }));
  });

  it('activates, extends and ends a linked resource effect', async () => {
    battle.sortedCombatants.set([ally]);
    battle.currentCombatant.set(ally);
    component.character.set(character({
      resources: [{
        id: 'rage',
        name: 'Ярость',
        description: 'Сопротивление физическому урону.',
        current: 2,
        max: 2,
        recovery: 'long-rest',
        shortRestRestore: 1,
        activeEffect: { icon: '🔥', duration: 'until-next-turn-end' },
      }],
    }));

    component.useResource('rage');

    await vi.waitFor(() => expect(battle.addStatusEffect).toHaveBeenCalledWith(
      ally.id,
      'resource-active',
      expect.objectContaining({
        resourceId: 'rage',
        customLabel: 'Ярость',
        customIcon: '🔥',
        trigger: 'turn-end',
        durationTriggers: 2,
        durationLabel: 'до конца следующего хода',
      }),
    ));
    expect(component.resourceUseConfirmation()?.activated).toBe(true);

    battle.sortedCombatants.set([{
      ...ally,
      activeEffects: [{
        id: 'effect-rage',
        type: 'resource-active',
        appliedAt: 1,
        resourceId: 'rage',
        remainingTriggers: 1,
      }],
    }]);
    component.extendResourceEffect('rage');

    await vi.waitFor(() => expect(battle.refreshStatusEffect).toHaveBeenCalledWith(
      ally.id,
      'effect-rage',
      2,
      'до конца следующего хода',
    ));
    await vi.waitFor(() => expect(component.resourceEffectConfirmation()).toEqual({
      resourceName: 'Ярость',
      durationLabel: 'до конца следующего хода',
      icon: '🔥',
    }));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.resource-extension-confirmation')).toHaveTextContent(
      'Ресурс продлён',
    );

    component.closeResourceEffectConfirmation();
    component.endResourceEffect('rage');
    expect(battle.removeStatusEffect).toHaveBeenCalledWith(ally.id, 'effect-rage');
  });

  it('visually disables a depleted finite resource', () => {
    component.character.set(character({
      resources: [{
        id: 'rage',
        name: 'Ярость',
        current: 0,
        max: 2,
        recovery: 'long-rest',
      }],
    }));
    component.isLoggedIn.set(true);

    fixture.detectChanges();

    const card = fixture.nativeElement.querySelector('.player__resource-card--depleted');
    expect(card).toHaveTextContent('Ресурс исчерпан');
    expect(card.querySelector('button')).toBeDisabled();
    expect(card.querySelector('button')).toHaveTextContent('Исчерпан');
  });

  it('casts a linked spell without spending a spell slot', async () => {
    const healingWord = spell({ id: 'healing-word', name: 'Исцеляющее слово' });
    const freeCast = {
      id: 'free-healing-word',
      name: 'Бесплатное применение',
      linkedSpellId: healingWord.id,
      current: 1,
      max: 1,
      recovery: 'long-rest' as const,
    };
    component.character.set(character({
      spells: [healingWord],
      spellSlots: [{ level: 1, current: 2, max: 2 }],
      resources: [freeCast],
    }));

    component.useSpellWithResource(healingWord, freeCast);

    await vi.waitFor(() => expect(characterService.useResource).toHaveBeenCalledWith(
      'Aria',
      freeCast.id,
      1,
    ));
    expect(characterService.usePlayerSpell).not.toHaveBeenCalled();
    expect(component.spellUseConfirmation()).toEqual({
      spellName: 'Исцеляющее слово',
      isCantrip: false,
      slotLevel: null,
      resourceName: 'Бесплатное применение',
    });
  });

  it('does not show a resource confirmation when spending fails', async () => {
    characterService.useResource.mockResolvedValue(false);
    component.character.set(character({
      resources: [{ id: 'ki', name: 'Ци', current: 1, max: 2, recovery: 'short-rest' }],
    }));

    component.useResource('ki');

    await vi.waitFor(() => expect(component.usingResourceId()).toBeNull());
    expect(component.resourceUseConfirmation()).toBeNull();
    expect(component.resourceUseError()).not.toBeNull();
  });
});
