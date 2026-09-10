import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AvatarService } from '../../../core/services/avatar.service';
import { BattleService } from '../../../core/services/battle.service';
import { CharacterService } from '../../../core/services/character.service';
import { LoggerService } from '../../../core/services/logger.service';
import { SceneLibraryService } from '../scene-library/scene-library.service';
import { DmPortraitsComponent } from './dm-portraits.component';

describe('DmPortraitsComponent', () => {
  let component: DmPortraitsComponent;
  let fixture: ComponentFixture<DmPortraitsComponent>;
  const avatar = {
    key: 'avatars/players/00000000-0000-4000-8000-000000000001.webp',
    version: 42,
  };
  const avatarService = {
    upload: vi.fn().mockResolvedValue(avatar),
    remove: vi.fn().mockResolvedValue(undefined),
    url: vi.fn().mockReturnValue(null),
  };
  const battleService = { syncAvatar: vi.fn().mockResolvedValue(undefined) };

  beforeEach(async () => {
    avatarService.upload.mockResolvedValue(avatar);
    avatarService.remove.mockResolvedValue(undefined);
    avatarService.url.mockReturnValue(null);
    battleService.syncAvatar.mockResolvedValue(undefined);
    TestBed.configureTestingModule({
      imports: [DmPortraitsComponent],
      providers: [
        { provide: AvatarService, useValue: avatarService },
        { provide: BattleService, useValue: battleService },
        {
          provide: CharacterService,
          useValue: {
            getAllPlayers: vi.fn().mockResolvedValue([
              {
                name: 'Aria',
                class: 'Wizard',
                level: 5,
                race: 'Elf',
                stats: { str: 8, dex: 14, con: 12, int: 18, wis: 11, cha: 10 },
                maxHp: 24,
                currentHp: 24,
                ac: 13,
                speed: 30,
                weapons: [],
                abilities: [],
              },
            ]),
          },
        },
        {
          provide: SceneLibraryService,
          useValue: { creatures: signal([]) },
        },
        { provide: LoggerService, useValue: { error: vi.fn() } },
      ],
    });

    fixture = TestBed.createComponent(DmPortraitsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('selects a player and saves the cropped portrait into storage and the active battle', async () => {
    component.selectOwner('Aria');
    component.croppedBlob.set(new Blob(['portrait'], { type: 'image/webp' }));

    await component.savePortrait();
    fixture.detectChanges();

    expect(avatarService.upload).toHaveBeenCalledWith(
      'player',
      'Aria',
      expect.any(Blob),
    );
    expect(battleService.syncAvatar).toHaveBeenCalledWith('player', 'Aria', avatar);
    expect(component.players()[0].avatar).toEqual(avatar);
    expect(fixture.nativeElement).toHaveTextContent('Портрет для «Aria» сохранён.');
  });

  it('switches to the creature catalog without keeping the previous selection', () => {
    component.selectOwner('Aria');
    component.selectOwnerType('creature');

    expect(component.ownerType()).toBe('creature');
    expect(component.selectedOwner()).toBeNull();
  });
});