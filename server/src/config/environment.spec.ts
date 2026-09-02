import { describe, expect, it } from 'vitest';
import { readEnvironment } from './environment';

describe('readEnvironment', () => {
  it('provides local development defaults', () => {
    expect(readEnvironment({}, 'C:/battle-forge/server')).toEqual({
      mongoUri: 'mongodb://localhost:27017/battle-forge',
      port: 8080,
      staticRoot: 'C:/battle-forge/server/public',
    });
  });

  it('normalizes configured values', () => {
    expect(
      readEnvironment(
        {
          MONGO_URI: ' mongodb://mongo:27017/game ',
          PORT: '9000',
          STATIC_ROOT: ' /opt/battle-forge/public ',
        },
        '.',
      ),
    ).toEqual({
      mongoUri: 'mongodb://mongo:27017/game',
      port: 9000,
      staticRoot: '/opt/battle-forge/public',
    });
  });

  it('rejects invalid ports', () => {
    expect(() => readEnvironment({ PORT: 'not-a-port' })).toThrow('PORT');
    expect(() => readEnvironment({ PORT: '70000' })).toThrow('PORT');
  });
});
