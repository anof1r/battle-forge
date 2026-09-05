import {
  BadGatewayException,
  BadRequestException,
  GatewayTimeoutException,
  Injectable,
} from '@nestjs/common';
import {
  OPEN5E_ALLOWED_PARAMS,
  OPEN5E_API_ROOT,
  OPEN5E_DEFAULT_LIMIT,
  OPEN5E_MAX_LIMIT,
  OPEN5E_RESOURCES,
  OPEN5E_TIMEOUT_MS,
  Open5eResource,
} from './open5e.constants';

/** Server-side proxy so the browser never calls api.open5e.com directly (avoids CORS and keeps the upstream host/params allow-listed). */
@Injectable()
export class Open5eProxyService {
  async search(resource: string, query: Record<string, unknown>): Promise<unknown> {
    if (!this.isKnownResource(resource)) {
      throw new BadRequestException('Unsupported Open5e resource.');
    }

    const params = new URLSearchParams();
    for (const key of OPEN5E_ALLOWED_PARAMS) {
      const value = this.stringParam(query[key]);
      if (value === null) continue;
      params.set(key, key === 'limit' ? String(this.clampLimit(value)) : value);
    }
    if (!params.has('limit')) params.set('limit', String(OPEN5E_DEFAULT_LIMIT));

    const url = `${OPEN5E_API_ROOT}/${resource}/?${params.toString()}`;
    let response: Response;
    try {
      response = await fetch(url, { signal: AbortSignal.timeout(OPEN5E_TIMEOUT_MS) });
    } catch (error) {
      if (error instanceof Error && error.name === 'TimeoutError') {
        throw new GatewayTimeoutException('Open5e took too long to respond.');
      }
      throw new BadGatewayException('Open5e is currently unreachable.');
    }
    if (!response.ok) {
      throw new BadGatewayException(`Open5e request failed with status ${response.status}.`);
    }
    return response.json();
  }

  private isKnownResource(resource: string): resource is Open5eResource {
    return (OPEN5E_RESOURCES as readonly string[]).includes(resource);
  }

  private stringParam(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }

  private clampLimit(value: string): number {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) return OPEN5E_DEFAULT_LIMIT;
    return Math.min(parsed, OPEN5E_MAX_LIMIT);
  }
}
