import { TestBed } from '@angular/core/testing';
import { BehaviorSubject } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FIREBASE_ROOT } from '../../constants/firebase-paths.constants';
import { StoryScriptSection } from '../../models';
import { FirebaseService } from '../firebase.service';
import { LoggerService } from '../logger.service';
import { StoryScriptService } from '../story-script.service';

describe('StoryScriptService', () => {
  let service: StoryScriptService;
  let records: BehaviorSubject<Record<string, Partial<StoryScriptSection>> | null>;
  let firebase: {
    subscribe: ReturnType<typeof vi.fn>;
    set: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    records = new BehaviorSubject<Record<string, Partial<StoryScriptSection>> | null>({
      '1': { id: 'legacy-id', text: '# Таверна', createdAt: 100, lastUpdated: 200 },
      '2': { text: undefined, createdAt: Number.NaN },
    });
    firebase = {
      subscribe: vi.fn().mockReturnValue(records.asObservable()),
      set: vi.fn().mockResolvedValue(undefined),
    };

    TestBed.configureTestingModule({
      providers: [
        StoryScriptService,
        { provide: FirebaseService, useValue: firebase },
        { provide: LoggerService, useValue: { error: vi.fn() } },
      ],
    });
    service = TestBed.inject(StoryScriptService);
    vi.spyOn(Date, 'now').mockReturnValue(500);
  });

  it('subscribes to the main story and normalizes incomplete records', () => {
    expect(firebase.subscribe).toHaveBeenCalledWith(FIREBASE_ROOT.MAIN_STORY_SECTIONS);
    expect(service.section('1')).toEqual({
      id: '1',
      text: '# Таверна',
      createdAt: 100,
      lastUpdated: 200,
    });
    expect(service.section('2')).toEqual({
      id: '2',
      text: '',
      createdAt: 0,
      lastUpdated: 0,
    });
    expect(service.section('missing')).toBeNull();
  });

  it('saves by image key and preserves the original creation time', async () => {
    await service.saveSection('1', '# Обновлённая таверна');

    expect(firebase.set).toHaveBeenCalledWith('dm-library/stories/main/sections/1', {
      id: '1',
      text: '# Обновлённая таверна',
      createdAt: 100,
      lastUpdated: 500,
    });
  });

  it('rejects an empty section id without writing to Firebase', async () => {
    await expect(service.saveSection('  ', 'text')).rejects.toThrow('Story section id is required');
    expect(firebase.set).not.toHaveBeenCalled();
  });
});
