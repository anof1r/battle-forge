import '@testing-library/jest-dom/vitest';
import '@angular/compiler';
import { setupTestBed } from '@analogjs/vitest-angular/setup-testbed';
import { vi } from 'vitest';

setupTestBed();

vi.mock('@angular/fire/database', () => ({
  Database: vi.fn(),
  ref: vi.fn(),
  onValue: vi.fn((_ref, callback) => {
    callback({ val: () => null });
    return () => {};
  }),
  set: vi.fn().mockResolvedValue(undefined),
  update: vi.fn().mockResolvedValue(undefined),
  remove: vi.fn().mockResolvedValue(undefined),
  push: vi.fn(() => ({ key: 'mock-key' })),
}));

if (!globalThis.crypto) {
  // @ts-ignore
  globalThis.crypto = { randomUUID: () => 'mock-uuid' };
}
