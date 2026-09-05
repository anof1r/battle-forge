import { BadGatewayException, BadRequestException, GatewayTimeoutException } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Open5eProxyService } from './open5e-proxy.service';

describe('Open5eProxyService', () => {
  let service: Open5eProxyService;

  beforeEach(() => {
    service = new Open5eProxyService();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('rejects unknown resources without calling the upstream API', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    await expect(service.search('players', {})).rejects.toBeInstanceOf(BadRequestException);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('forwards only allow-listed params and clamps the limit', async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValue({ ok: true, json: () => Promise.resolve({ results: [] }) });
    vi.stubGlobal('fetch', fetchSpy);

    await service.search('spells', {
      name__icontains: 'Wolf',
      limit: '9999',
      document__key__in: 'srd-2024',
      unexpected: 'ignored',
    });

    const requestedUrl = new URL(fetchSpy.mock.calls[0][0] as string);
    expect(requestedUrl.origin + requestedUrl.pathname).toBe('https://api.open5e.com/v2/spells/');
    expect(requestedUrl.searchParams.get('name__icontains')).toBe('Wolf');
    expect(requestedUrl.searchParams.get('document__key__in')).toBe('srd-2024');
    expect(requestedUrl.searchParams.get('limit')).toBe('50');
    expect(requestedUrl.searchParams.has('unexpected')).toBe(false);
  });

  it('applies a default limit when none is provided', async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValue({ ok: true, json: () => Promise.resolve({ results: [] }) });
    vi.stubGlobal('fetch', fetchSpy);

    await service.search('creatures', {});

    const requestedUrl = new URL(fetchSpy.mock.calls[0][0] as string);
    expect(requestedUrl.searchParams.get('limit')).toBe('30');
  });

  it('raises a bad gateway error when the upstream request fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 504 }));

    await expect(service.search('items', {})).rejects.toBeInstanceOf(BadGatewayException);
  });

  it('raises a bad gateway error when the upstream request throws', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));

    await expect(service.search('items', {})).rejects.toBeInstanceOf(BadGatewayException);
  });

  it('raises a gateway timeout error when the upstream request is aborted by the timeout', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new DOMException('The operation timed out.', 'TimeoutError')),
    );

    await expect(service.search('items', {})).rejects.toBeInstanceOf(GatewayTimeoutException);
  });
});
