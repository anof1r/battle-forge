import { describe, expect, it, vi } from 'vitest';
import { generateUuid } from './uuid.util';

describe('generateUuid', () => {
  it('uses the native UUID API when available', () => {
    const native = vi
      .spyOn(crypto, 'randomUUID')
      .mockReturnValue('12345678-1234-4234-8234-123456789abc');
    expect(generateUuid()).toBe('12345678-1234-4234-8234-123456789abc');
    expect(native).toHaveBeenCalledOnce();
  });

  it.each([
    [0x00, '00000000-0000-4000-8000-000000000000'],
    [0xff, 'ffffffff-ffff-4fff-bfff-ffffffffffff'],
  ])('creates a UUID v4 from random bytes %i when randomUUID is absent', (byte, expected) => {
    const getRandomValues = vi.fn((bytes: Uint8Array) => bytes.fill(byte));
    vi.stubGlobal('crypto', { getRandomValues });
    expect(generateUuid()).toBe(expected);
    expect(getRandomValues).toHaveBeenCalledOnce();
    expect(getRandomValues.mock.calls[0][0]).toHaveLength(16);
  });

  it('requests fresh entropy for each ID on HTTP', () => {
    let seed = 0;
    vi.stubGlobal('crypto', { getRandomValues: (bytes: Uint8Array) => bytes.fill(++seed) });
    expect(generateUuid()).not.toBe(generateUuid());
  });
});
