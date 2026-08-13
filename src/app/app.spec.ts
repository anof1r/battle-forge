import { describe, it, expect, vi } from 'vitest';

describe('Simple test', () => {
  it('should pass', () => {
    expect(1 + 1).toBe(2);
  });

  it('should use vi', () => {
    const fn = vi.fn();
    fn();
    expect(fn).toHaveBeenCalled();
  });
});
