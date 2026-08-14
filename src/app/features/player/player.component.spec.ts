import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { BattleService } from '../../core/services/battle.service';
import { CharacterService } from '../../core/services/character.service';
import { CharacterParserService } from '../../core/services/characterParser.service';
import { InventoryService } from '../../core/services/inventory.service';
import { LoggerService } from '../../core/services/logger.service';
import { PlayerComponent } from './player.component';

describe('PlayerComponent', () => {
  it('creates without initializing Firebase and validates an empty login', () => {
    TestBed.configureTestingModule({
      imports: [PlayerComponent],
      providers: [
        {
          provide: BattleService,
          useValue: {
            aliveEnemies: signal([]),
            currentCombatant: signal(null),
            currentRound: signal(1),
            takeDamage: vi.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: CharacterService,
          useValue: {
            characterExists: vi.fn(),
            loadCharacter: vi.fn(),
            subscribeToCharacter: vi.fn(),
          },
        },
        { provide: InventoryService, useValue: { consumeItem: vi.fn() } },
        {
          provide: CharacterParserService,
          useValue: { parseCharacter: vi.fn(), getModifier: vi.fn().mockReturnValue(0) },
        },
        { provide: LoggerService, useValue: { error: vi.fn() } },
      ],
    });

    const fixture = TestBed.createComponent(PlayerComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    component.login();

    expect(component.loginError()).not.toBeNull();
    expect(component.isLoggedIn()).toBe(false);
  });
});
