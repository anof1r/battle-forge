import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map, of } from 'rxjs';
import {
  EnemyAbility,
  EnemyAction,
  Open5eCreature,
  Open5eDocumentRef,
  Open5eSpell,
  Open5eWeapon,
} from '../models';

type JsonRecord = Record<string, unknown>;

@Injectable({ providedIn: 'root' })
export class Open5eService {
  private readonly http = inject(HttpClient);
  private readonly apiRoot = 'https://api.open5e.com/v2';

  searchSpells(query: string, documentKey = ''): Observable<Open5eSpell[]> {
    return this.search(`${this.apiRoot}/spells/`, query, documentKey).pipe(
      map((records) => records.map((record) => this.toSpell(record)).filter(this.isPresent)),
    );
  }

  searchCreatures(query: string, documentKey = ''): Observable<Open5eCreature[]> {
    return this.search(`${this.apiRoot}/creatures/`, query, documentKey).pipe(
      map((records) => records.map((record) => this.toCreature(record)).filter(this.isPresent)),
    );
  }

  searchWeapons(query: string, documentKey = ''): Observable<Open5eWeapon[]> {
    return this.search(`${this.apiRoot}/items/`, query, documentKey, { is_weapon: 'true' }).pipe(
      map((records) => records.map((record) => this.toWeapon(record)).filter(this.isPresent)),
    );
  }

  private search(
    url: string,
    query: string,
    documentKey: string,
    extraParams: Record<string, string> = {},
  ): Observable<JsonRecord[]> {
    const normalizedQuery = query.trim();
    if (!normalizedQuery) return of([]);
    let params = new HttpParams().set('name__icontains', normalizedQuery).set('limit', 30);
    if (documentKey) params = params.set('document__key__in', documentKey);
    for (const [key, value] of Object.entries(extraParams)) params = params.set(key, value);
    return this.http.get<unknown>(url, { params }).pipe(map((payload) => this.readResults(payload)));
  }

  private toSpell(record: JsonRecord): Open5eSpell | null {
    const name = this.string(record['name']);
    const key = this.string(record['key']);
    if (!name || !key) return null;
    const damageTypes = this.array(record['damage_types'])
      .map((value) => this.nameFrom(value))
      .filter(Boolean);
    const components = [
      this.boolean(record['verbal']) ? 'В' : '',
      this.boolean(record['somatic']) ? 'С' : '',
      this.boolean(record['material']) ? 'М' : '',
    ].filter(Boolean);
    const material = this.string(record['material_specified']);
    return {
      kind: 'spell',
      key,
      name,
      description: this.string(record['desc']),
      document: this.document(record['document']),
      level: this.integer(record['level'], 0, 0, 9),
      school: this.nameFrom(record['school']),
      higherLevel: this.string(record['higher_level']),
      damageFormula: this.string(record['damage_roll']),
      damageTypes,
      castingTime: this.string(record['casting_time']),
      range: this.distance(record['range_text'], record['range'], record['range_unit']),
      duration: this.string(record['duration']),
      components: `${components.join(', ')}${material ? ` (${material})` : ''}`,
      ritual: this.boolean(record['ritual']),
      concentration: this.boolean(record['concentration']),
    };
  }

  private toWeapon(record: JsonRecord): Open5eWeapon | null {
    const weapon = this.record(record['weapon']) ?? record;
    const name = this.string(record['name']) || this.string(weapon['name']);
    const key = this.string(record['key']) || this.string(weapon['key']);
    if (!name || !key) return null;
    const properties = this.array(weapon['properties']).map((entry) => {
      const assignment = this.record(entry);
      const property = assignment ? this.record(assignment['property']) : null;
      const propertyName = property ? this.string(property['name']) : '';
      const detail = assignment ? this.string(assignment['detail']) : '';
      return `${propertyName}${detail ? ` (${detail})` : ''}`.trim();
    }).filter(Boolean);
    return {
      kind: 'weapon',
      key,
      name,
      description: this.string(record['desc']) || properties.join(', '),
      document: this.document(record['document']),
      damageFormula: this.string(weapon['damage_dice']),
      damageType: this.nameFrom(weapon['damage_type']),
      properties,
      range: this.distance('', weapon['range'], weapon['distance_unit'], weapon['long_range']),
    };
  }

  private toCreature(record: JsonRecord): Open5eCreature | null {
    const name = this.string(record['name']);
    const key = this.string(record['key']);
    if (!name || !key) return null;
    const resistanceBlock = this.record(record['resistances_and_immunities']);
    const resistanceDisplay = resistanceBlock
      ? this.string(resistanceBlock['damage_resistances_display'])
      : '';
    const resistanceObjects = resistanceBlock
      ? this.array(resistanceBlock['damage_resistances']).map((value) => this.nameFrom(value))
      : [];
    const actions = this.array(record['actions']).flatMap((value) => this.toCreatureActions(value));
    const abilities = this.array(record['traits'])
      .map((value) => this.toCreatureAbility(value))
      .filter(this.isPresent);
    const type = this.nameFrom(record['type']);
    return {
      kind: 'creature',
      key,
      name,
      description: '',
      document: this.document(record['document']),
      subtype: this.string(record['subcategory']) || type,
      challengeRating: this.number(record['challenge_rating'], 0),
      maxHp: this.integer(record['hit_points'], 1, 1),
      ac: this.integer(record['armor_class'], 10, 1),
      resistances: resistanceDisplay
        ? resistanceDisplay.split(/[,;]/).map((item) => item.trim()).filter(Boolean)
        : resistanceObjects.filter(Boolean),
      actions,
      abilities,
    };
  }

  private toCreatureActions(value: unknown): EnemyAction[] {
    const action = this.record(value);
    if (!action) return [];
    const name = this.string(action['name']);
    if (!name) return [];
    const fullText = this.string(action['desc']);
    const attacks = this.array(action['attacks']).map((attack) => this.record(attack)).filter(this.isPresent);
    if (attacks.length === 0) {
      return [{ name, description: this.string(action['action_type']), toHit: '', damage: '', damageType: '', fullText }];
    }
    return attacks.map((attack, index) => {
      const attackName = this.string(attack['name']);
      const damageCount = this.integer(attack['damage_die_count'], 0, 0);
      const damageDie = this.dieSize(attack['damage_die_type']);
      const damageBonus = this.number(attack['damage_bonus'], 0);
      const damage = damageCount > 0 && damageDie > 0
        ? `${damageCount}d${damageDie}${damageBonus ? ` ${damageBonus > 0 ? '+' : '-'} ${Math.abs(damageBonus)}` : ''}`
        : '';
      const toHit = this.number(attack['to_hit_mod'], 0);
      return {
        name: attacks.length > 1 && attackName ? `${name} — ${attackName}` : name,
        description: this.string(action['action_type']),
        toHit: `${toHit >= 0 ? '+' : ''}${toHit}`,
        damage,
        damageType:
          this.nameFrom(attack['damage_type']) || this.nameFrom(attack['extra_damage_type']),
        fullText: index === 0 ? fullText : '',
      };
    });
  }

  private toCreatureAbility(value: unknown): EnemyAbility | null {
    const record = this.record(value);
    if (!record) return null;
    const name = this.string(record['name']);
    if (!name) return null;
    return { name, description: this.string(record['desc']) };
  }

  private readResults(payload: unknown): JsonRecord[] {
    const root = this.record(payload);
    const values = Array.isArray(payload) ? payload : root ? root['results'] : [];
    return this.array(values).map((value) => this.record(value)).filter(this.isPresent);
  }

  private document(value: unknown): Open5eDocumentRef {
    const record = this.record(value);
    return {
      key: record ? this.string(record['key']) : '',
      name: record
        ? this.string(record['display_name']) || this.string(record['name']) || 'Open5e'
        : 'Open5e',
      permalink: record ? this.string(record['permalink']) : '',
    };
  }

  private distance(
    text: unknown,
    distance: unknown,
    unit: unknown,
    longDistance?: unknown,
  ): string {
    const label = this.string(text);
    if (label) return label;
    const value = this.number(distance, 0);
    if (!value) return '';
    const longValue = this.number(longDistance, 0);
    const suffix = this.string(unit);
    return `${value}${longValue ? `/${longValue}` : ''}${suffix ? ` ${suffix}` : ''}`;
  }

  private nameFrom(value: unknown): string {
    if (typeof value === 'string') return value.trim();
    const record = this.record(value);
    return record ? this.string(record['name']) : '';
  }

  private record(value: unknown): JsonRecord | null {
    return value !== null && typeof value === 'object' && !Array.isArray(value)
      ? (value as JsonRecord)
      : null;
  }

  private array(value: unknown): unknown[] {
    return Array.isArray(value) ? value : [];
  }

  private string(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
  }

  private number(value: unknown, fallback: number): number {
    const parsed = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  private integer(value: unknown, fallback: number, minimum: number, maximum = Infinity): number {
    return Math.min(maximum, Math.max(minimum, Math.floor(this.number(value, fallback))));
  }

  private boolean(value: unknown): boolean {
    return value === true;
  }

  private dieSize(value: unknown): number {
    const normalized = typeof value === 'string' ? value.replace(/^d/i, '') : value;
    return this.integer(normalized, 0, 0);
  }

  private isPresent<T>(value: T | null): value is T {
    return value !== null;
  }
}
