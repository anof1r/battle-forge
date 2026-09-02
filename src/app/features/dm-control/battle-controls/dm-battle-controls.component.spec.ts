import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BATTLE_STATUS } from '../../../core/constants/battle-status.constants';
import { COMBATANT_STATUS, COMBATANT_TYPE } from '../../../core/constants/combatant.constants';
import { BattleService } from '../../../core/services/battle.service';
import { CharacterService } from '../../../core/services/character.service';
import { LoggerService } from '../../../core/services/logger.service';
import { DmBattleControlsComponent } from './dm-battle-controls.component';

describe('DmBattleControlsComponent', () => {
  let component: DmBattleControlsComponent;
  const createBattle = () => ({
    battleStatus: signal(BATTLE_STATUS.PREPARATION),
    canUndo: signal(false),
    enemies: signal({}),
    syncPlayersToBattle: vi.fn().mockResolvedValue(undefined),
    startBattle: vi.fn().mockResolvedValue(undefined),
    nextTurn: vi.fn().mockResolvedValue(undefined),
    undoLastAction: vi.fn().mockResolvedValue(undefined),
    finishScene: vi.fn().mockResolvedValue(undefined),
    resetScene: vi.fn().mockResolvedValue(undefined),
  });
  let battle: ReturnType<typeof createBattle>;
  let characters: { getAllPlayers: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    battle = createBattle();
    characters = { getAllPlayers: vi.fn().mockResolvedValue([]) };
    TestBed.configureTestingModule({
      imports: [DmBattleControlsComponent],
      providers: [
        { provide: BattleService, useValue: battle },
        { provide: CharacterService, useValue: characters },
        { provide: LoggerService, useValue: { error: vi.fn() } },
      ],
    });
    component = TestBed.createComponent(DmBattleControlsComponent).componentInstance;
  });

  it('synchronizes stored players when mounted', async () => {
    component.ngOnInit();

    await vi.waitFor(() => expect(battle.syncPlayersToBattle).toHaveBeenCalledWith([]));
    await vi.waitFor(() => expect(component.playersLoading()).toBe(false));
  });

  it('emits local enemy d20 rolls for the initiative editor', () => {
    battle.enemies.set({
      goblin: {
        id: 'goblin',
        type: COMBATANT_TYPE.ENEMY,
        name: 'Goblin',
        initiative: 0,
        ac: 12,
        maxHp: 7,
        currentHp: 7,
        status: COMBATANT_STATUS.ALIVE,
      },
    });
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const emit = vi.spyOn(component.initiativeRequested, 'emit');

    component.startInitiativeRolls();

    expect(emit).toHaveBeenCalledWith({ goblin: 11 });
  });

  it('finishes a confirmed scene and notifies the shell only after success', async () => {
    vi.stubGlobal('confirm', vi.fn().mockReturnValue(true));
    const closed = vi.spyOn(component.initiativeClosed, 'emit');
    const finished = vi.spyOn(component.sceneFinished, 'emit');

    component.finishScene('short-rest');

    await vi.waitFor(() => expect(battle.finishScene).toHaveBeenCalledWith('short-rest'));
    expect(closed).toHaveBeenCalledOnce();
    expect(finished).toHaveBeenCalledOnce();
  });
});
