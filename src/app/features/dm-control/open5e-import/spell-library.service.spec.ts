import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DATA_ROOT } from '../../../core/constants/data-paths.constants';
import { SpellTemplate } from '../../../core/models';
import { RealtimeDataService } from '../../../core/services/realtime-data.service';
import { SpellLibraryService } from './spell-library.service';

describe('SpellLibraryService', () => {
  let service: SpellLibraryService;
  let realtimeData: { subscribe: ReturnType<typeof vi.fn>; set: ReturnType<typeof vi.fn>; remove: ReturnType<typeof vi.fn> };

  const spell = (overrides: Partial<SpellTemplate> = {}): SpellTemplate => ({
    id: 'spell_open5e_srd-2024_magic-missile',
    name: 'Волшебная стрела',
    level: 1,
    school: 'Воплощение',
    description: 'Создаёт три магических дротика.',
    higherLevel: '',
    damageFormula: '3d4 + 3',
    damageType: 'силовой',
    castingTime: 'действие',
    range: '120 футов',
    duration: 'мгновенная',
    components: 'В, С',
    isCantrip: false,
    isRitual: false,
    requiresConcentration: false,
    source: {
      provider: 'open5e',
      key: 'magic-missile',
      documentKey: 'srd-2024',
      documentName: 'SRD 2024',
      permalink: '',
      originalName: 'Magic Missile',
      originalDescription: 'Three darts.',
      importedAt: 100,
    },
    createdAt: 100,
    lastUpdated: 100,
    ...overrides,
  });

  beforeEach(() => {
    const existing = spell();
    realtimeData = {
      subscribe: vi.fn((path: string) => path === DATA_ROOT.SPELL_TEMPLATES ? of({ [existing.id]: existing }) : of(null)),
      set: vi.fn().mockResolvedValue(undefined),
      remove: vi.fn().mockResolvedValue(undefined),
    };
    TestBed.configureTestingModule({
      providers: [SpellLibraryService, { provide: RealtimeDataService, useValue: realtimeData }],
    });
    service = TestBed.inject(SpellLibraryService);
    vi.spyOn(Date, 'now').mockReturnValue(500);
  });

  it('projects saved spells and preserves creation time on translation updates', async () => {
    expect(service.spells()[0].name).toBe('Волшебная стрела');

    const updated = spell({ name: 'Магическая стрела', createdAt: 0, lastUpdated: 0 });
    await service.saveSpell(updated);

    expect(realtimeData.set).toHaveBeenCalledWith(
      `dm-library/spells/${updated.id}`,
      expect.objectContaining({ name: 'Магическая стрела', createdAt: 100, lastUpdated: 500 }),
    );
  });

  it('removes a saved spell', async () => {
    await service.deleteSpell('spell-id');
    expect(realtimeData.remove).toHaveBeenCalledWith('dm-library/spells/spell-id');
  });
});
