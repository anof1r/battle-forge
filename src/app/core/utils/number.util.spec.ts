import { describe, expect, it } from 'vitest';
import { clampInteger, isPositiveInteger } from './number.util';

describe('numeric input boundaries', () => {
  it.each([
    ['3.9', 3],
    ['-2', 1],
    ['99', 5],
    ['', 1],
    ['invalid', 1],
    [NaN, 1],
    [Infinity, 1],
  ])('normalizes %s within the form limits', (input, expected) => {
    expect(clampInteger(input, 1, 5)).toBe(expected);
  });

  it('rejects invalid domain quantities instead of clamping them', () => {
    expect(isPositiveInteger(1)).toBe(true);
    expect(isPositiveInteger(Number.MAX_SAFE_INTEGER)).toBe(true);
    for (const quantity of [0, -1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
      expect(isPositiveInteger(quantity)).toBe(false);
    }
  });
});
