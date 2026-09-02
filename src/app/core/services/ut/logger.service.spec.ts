import { afterEach, describe, expect, it, vi } from 'vitest';
import { LoggerService } from '../logger.service';

describe('LoggerService', () => {
  const service = new LoggerService();

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('prefixes errors with their context', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const error = new Error('failed');

    service.error('BattleService', error);

    expect(consoleError).toHaveBeenCalledWith('[BattleService]', error);
  });

  it('prefixes warnings and informational messages with their context', () => {
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const consoleInfo = vi.spyOn(console, 'info').mockImplementation(() => undefined);

    service.warn('InventoryService', 'low stock');
    service.info('RealtimeDataService', 'connected');

    expect(consoleWarn).toHaveBeenCalledWith('[InventoryService]', 'low stock');
    expect(consoleInfo).toHaveBeenCalledWith('[RealtimeDataService]', 'connected');
  });
});
