import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { Open5eService } from './open5e.service';

describe('Open5eService', () => {
  let service: Open5eService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [Open5eService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(Open5eService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('searches V2 spells and normalizes nested fields', () => {
    let result: ReturnType<typeof service.searchSpells> extends import('rxjs').Observable<infer T>
      ? T
      : never = [];
    service.searchSpells('Magic Missile', 'srd-2024').subscribe((value) => (result = value));

    const request = http.expectOne((candidate) => candidate.url.endsWith('/v2/spells/'));
    expect(request.request.params.get('name__icontains')).toBe('Magic Missile');
    expect(request.request.params.get('document__key__in')).toBe('srd-2024');
    request.flush({
      results: [
        {
          key: 'magic-missile',
          name: 'Magic Missile',
          desc: 'Three glowing darts strike targets.',
          level: 1,
          school: { name: 'Evocation' },
          damage_roll: '3d4 + 3',
          damage_types: [{ name: 'Force' }],
          casting_time: 'action',
          range: 120,
          range_unit: 'feet',
          duration: 'instantaneous',
          verbal: true,
          somatic: true,
          material: false,
          ritual: false,
          concentration: false,
          document: {
            key: 'srd-2024',
            display_name: 'SRD 2024',
            permalink: 'https://open5e.com/sources/srd-2024',
          },
        },
      ],
    });

    expect(result).toEqual([
      expect.objectContaining({
        kind: 'spell',
        name: 'Magic Missile',
        school: 'Evocation',
        damageFormula: '3d4 + 3',
        damageTypes: ['Force'],
        range: '120 feet',
        components: 'В, С',
      }),
    ]);
  });

  it('normalizes creature attacks, traits and missing optional collections', () => {
    let result: unknown[] = [];
    service.searchCreatures('Goblin').subscribe((value) => (result = value));

    const request = http.expectOne((candidate) => candidate.url.endsWith('/v2/creatures/'));
    request.flush({
      results: [
        {
          key: 'goblin',
          name: 'Goblin',
          document: { key: 'srd-2024', name: 'SRD 2024' },
          type: { name: 'Humanoid' },
          subcategory: 'Goblin',
          challenge_rating: 0.25,
          hit_points: 7,
          armor_class: 15,
          resistances_and_immunities: { damage_resistances_display: '' },
          actions: [
            {
              name: 'Scimitar',
              desc: 'Melee Weapon Attack.',
              action_type: 'action',
              attacks: [
                {
                  to_hit_mod: 4,
                  damage_die_count: 1,
                  damage_die_type: 'D6',
                  damage_bonus: 2,
                  damage_type: null,
                  extra_damage_type: { name: 'Slashing' },
                },
              ],
            },
          ],
          traits: [{ name: 'Nimble Escape', desc: 'The goblin can Disengage.' }],
        },
      ],
    });

    expect(result).toEqual([
      expect.objectContaining({
        name: 'Goblin',
        maxHp: 7,
        ac: 15,
        actions: [
          expect.objectContaining({
            name: 'Scimitar',
            toHit: '+4',
            damage: '1d6 + 2',
            damageType: 'Slashing',
          }),
        ],
        abilities: [{ name: 'Nimble Escape', description: 'The goblin can Disengage.' }],
      }),
    ]);
  });

  it('searches weapon items by partial name and unwraps their weapon data', () => {
    let result: unknown[] = [];
    service.searchWeapons('long').subscribe((value) => (result = value));

    const request = http.expectOne((candidate) => candidate.url.endsWith('/v2/items/'));
    expect(request.request.params.get('is_weapon')).toBe('true');
    expect(request.request.params.get('name__icontains')).toBe('long');
    request.flush({
      results: [
        {
          key: 'srd-2024_longsword',
          name: 'Longsword',
          desc: 'A martial melee weapon.',
          document: { key: 'srd-2024', display_name: '5e 2024 Rules' },
          weapon: {
            damage_dice: '1d8',
            damage_type: { name: 'Slashing' },
            properties: [
              { property: { name: 'Versatile' }, detail: '1d10' },
            ],
          },
        },
      ],
    });

    expect(result).toEqual([
      expect.objectContaining({
        kind: 'weapon',
        name: 'Longsword',
        damageFormula: '1d8',
        damageType: 'Slashing',
        properties: ['Versatile (1d10)'],
      }),
    ]);
  });

  it('does not send a request for an empty query', () => {
    service.searchWeapons('   ').subscribe((result) => expect(result).toEqual([]));
    http.expectNone(() => true);
  });
});
