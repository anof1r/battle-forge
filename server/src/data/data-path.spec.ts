import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { DataPathResolver } from './data-path';

describe('DataPathResolver', () => {
  const resolver = new DataPathResolver();

  it('resolves collection, entity and nested Firebase-compatible paths', () => {
    expect(resolver.resolve('/players/')).toEqual({
      collectionPath: 'players',
      entityKey: null,
      entityPath: null,
      nestedSegments: [],
      normalizedPath: 'players',
    });
    expect(resolver.resolve('rooms/main-room/combatants/enemy-1/currentHp')).toEqual({
      collectionPath: 'rooms',
      entityKey: 'main-room',
      entityPath: 'rooms/main-room',
      nestedSegments: ['combatants', 'enemy-1', 'currentHp'],
      normalizedPath: 'rooms/main-room/combatants/enemy-1/currentHp',
    });
    expect(resolver.resolve('dm-library/stories/main/sections/1')).toEqual({
      collectionPath: 'dm-library/stories/main/sections',
      entityKey: '1',
      entityPath: 'dm-library/stories/main/sections/1',
      nestedSegments: [],
      normalizedPath: 'dm-library/stories/main/sections/1',
    });
  });

  it('builds relative multi-location update paths', () => {
    expect(resolver.child('rooms/main-room', 'combatants/enemy-1/currentHp').normalizedPath).toBe(
      'rooms/main-room/combatants/enemy-1/currentHp',
    );
  });

  it('recognizes parent and child subscriptions as related', () => {
    expect(resolver.isRelated('players', 'players/Aria')).toBe(true);
    expect(resolver.isRelated('players/Aria/currentHp', 'players/Aria')).toBe(true);
    expect(resolver.isRelated('players/Aria', 'players/Borin')).toBe(false);
  });

  it('rejects unknown roots and Firebase-incompatible segments', () => {
    expect(() => resolver.resolve('unknown/value')).toThrow(BadRequestException);
    expect(() => resolver.resolve('players/bad.name')).toThrow(BadRequestException);
  });
});
