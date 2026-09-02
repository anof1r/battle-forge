import { TestBed } from '@angular/core/testing';
import { BehaviorSubject } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DATA_ROOT } from '../../../core/constants/data-paths.constants';
import { StoryScriptSection } from '../../../core/models';
import { RealtimeDataService } from '../../../core/services/realtime-data.service';
import { LoggerService } from '../../../core/services/logger.service';
import { StoryScriptService } from './story-script.service';

describe('StoryScriptService', () => {
  let service: StoryScriptService;
  let records: BehaviorSubject<Record<string, Partial<StoryScriptSection>> | null>;
  let realtimeData: {
    subscribe: ReturnType<typeof vi.fn>;
    set: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    records = new BehaviorSubject<Record<string, Partial<StoryScriptSection>> | null>({
      '1': { id: 'legacy-id', text: '# Таверна', createdAt: 100, lastUpdated: 200 },
      '2': { text: undefined, createdAt: Number.NaN },
    });
    realtimeData = {
      subscribe: vi.fn().mockReturnValue(records.asObservable()),
      set: vi.fn().mockResolvedValue(undefined),
    };

    TestBed.configureTestingModule({
      providers: [
        StoryScriptService,
        { provide: RealtimeDataService, useValue: realtimeData },
        { provide: LoggerService, useValue: { error: vi.fn() } },
      ],
    });
    service = TestBed.inject(StoryScriptService);
    vi.spyOn(Date, 'now').mockReturnValue(500);
  });

  it('subscribes to the main story and normalizes incomplete records', () => {
    expect(realtimeData.subscribe).toHaveBeenCalledWith(DATA_ROOT.MAIN_STORY_SECTIONS);
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

    expect(realtimeData.set).toHaveBeenCalledWith('dm-library/stories/main/sections/1', {
      id: '1',
      text: '# Обновлённая таверна',
      createdAt: 100,
      lastUpdated: 500,
    });
  });

  it('rejects an empty section id without writing to database', async () => {
    await expect(service.saveSection('  ', 'text')).rejects.toThrow('Story section id is required');
    expect(realtimeData.set).not.toHaveBeenCalled();
  });
});
