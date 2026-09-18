import { TestBed } from '@angular/core/testing';
import { BehaviorSubject } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DISPLAY_SETTINGS_PATH } from '../constants/data-paths.constants';
import { DisplaySettings } from '../models/display-settings.model';
import { DisplaySettingsService } from './display-settings.service';
import { RealtimeDataService } from './realtime-data.service';

describe('DisplaySettingsService', () => {
  let records: BehaviorSubject<Partial<DisplaySettings> | null>;
  let realtimeData: {
    subscribe: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  let service: DisplaySettingsService;

  beforeEach(() => {
    records = new BehaviorSubject<Partial<DisplaySettings> | null>(null);
    realtimeData = {
      subscribe: vi.fn().mockReturnValue(records.asObservable()),
      update: vi.fn().mockResolvedValue(undefined),
    };
    TestBed.configureTestingModule({
      providers: [
        DisplaySettingsService,
        { provide: RealtimeDataService, useValue: realtimeData },
      ],
    });
    service = TestBed.inject(DisplaySettingsService);
  });

  it('shows enemy AC and health by default for existing installations', () => {
    expect(realtimeData.subscribe).toHaveBeenCalledWith(DISPLAY_SETTINGS_PATH);
    expect(service.settings()).toEqual({
      showEnemyArmorClass: true,
      showEnemyHealth: true,
      lastUpdated: 0,
    });
  });

  it('normalizes partial records and reacts to realtime changes', () => {
    records.next({ showEnemyArmorClass: false, lastUpdated: 42 });

    expect(service.showEnemyArmorClass()).toBe(false);
    expect(service.showEnemyHealth()).toBe(true);
    expect(service.settings().lastUpdated).toBe(42);
  });

  it('updates one visibility flag without overwriting the other one', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(500);

    await service.setVisibility('showEnemyHealth', false);

    expect(realtimeData.update).toHaveBeenCalledWith(DISPLAY_SETTINGS_PATH, {
      showEnemyHealth: false,
      lastUpdated: 500,
    });
  });
});
