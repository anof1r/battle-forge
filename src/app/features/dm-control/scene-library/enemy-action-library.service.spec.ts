import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { DATA_ROOT } from '../../../core/constants/data-paths.constants';
import { RealtimeDataService } from '../../../core/services/realtime-data.service';
import { EnemyActionLibraryService } from './enemy-action-library.service';

describe('EnemyActionLibraryService', () => {
  it('normalizes legacy records and saves reusable enemy attacks', async () => {
    const realtimeData = {
      subscribe: vi.fn((path: string) => path === DATA_ROOT.ENEMY_ACTION_TEMPLATES
        ? of({ legacy: { name: 'Кинжал', damage: '1d4' } })
        : of(null)),
      set: vi.fn().mockResolvedValue(undefined),
      remove: vi.fn().mockResolvedValue(undefined),
    };
    TestBed.configureTestingModule({
      providers: [EnemyActionLibraryService, { provide: RealtimeDataService, useValue: realtimeData }],
    });
    const service = TestBed.inject(EnemyActionLibraryService);

    expect(service.actions()[0]).toEqual(
      expect.objectContaining({ id: 'legacy', name: 'Кинжал', damageType: '', toHit: '' }),
    );

    await service.saveAction({
      id: 'weapon_open5e_srd-2024_longsword',
      name: 'Длинный меч',
      description: 'Воинское оружие',
      toHit: '+4',
      damage: '1d8 + 2',
      damageType: 'рубящий',
      fullText: '',
      source: {
        provider: 'open5e',
        key: 'longsword',
        documentKey: 'srd-2024',
        documentName: 'SRD 2024',
        permalink: '',
        originalName: 'Longsword',
        originalDescription: '',
        importedAt: 100,
      },
    });

    expect(realtimeData.set).toHaveBeenCalledWith(
      'dm-library/enemy-actions/weapon_open5e_srd-2024_longsword',
      expect.objectContaining({ name: 'Длинный меч', createdAt: expect.any(Number) }),
    );
  });
});
