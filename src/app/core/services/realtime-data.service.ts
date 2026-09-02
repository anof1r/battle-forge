import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, InjectionToken, inject } from '@angular/core';
import { Observable, finalize, firstValueFrom, shareReplay } from 'rxjs';
import { io, Socket } from 'socket.io-client';
import {
  REALTIME_DATA_ENDPOINT,
  REALTIME_DATA_EVENT,
} from '../constants/realtime-data.constants';
import {
  RealtimeDataChangedEvent,
  RealtimeDataSubscription,
  RealtimeMutationResponse,
} from '../models/realtime-data.model';
import { LoggerService } from './logger.service';

export const REALTIME_SOCKET = new InjectionToken<Socket>('Battle Forge realtime socket', {
  providedIn: 'root',
  factory: () => io({ autoConnect: false }),
});

@Injectable({ providedIn: 'root' })
export class RealtimeDataService {
  private readonly http = inject(HttpClient);
  private readonly logger = inject(LoggerService);
  private readonly socket = inject(REALTIME_SOCKET);
  private readonly subscriptions = new Map<string, Observable<unknown | null>>();

  async get<T>(path: string): Promise<T | null> {
    const normalizedPath = this.normalizePath(path);
    try {
      const params = new HttpParams().set('path', normalizedPath);
      return await firstValueFrom(this.http.get<T | null>(REALTIME_DATA_ENDPOINT, { params }));
    } catch (error) {
      this.logger.error('RealtimeDataService.get', error);
      throw error;
    }
  }

  async set<T>(path: string, data: T): Promise<void> {
    await this.mutate('set', () =>
      this.http.put<RealtimeMutationResponse>(REALTIME_DATA_ENDPOINT, {
        path: this.normalizePath(path),
        data,
      }),
    );
  }

  async update(path: string, data: Record<string, unknown>): Promise<void> {
    await this.mutate('update', () =>
      this.http.patch<RealtimeMutationResponse>(REALTIME_DATA_ENDPOINT, {
        path: this.normalizePath(path),
        data,
      }),
    );
  }

  async remove(path: string): Promise<void> {
    const params = new HttpParams().set('path', this.normalizePath(path));
    await this.mutate('remove', () =>
      this.http.delete<RealtimeMutationResponse>(REALTIME_DATA_ENDPOINT, { params }),
    );
  }

  subscribe<T>(path: string): Observable<T | null> {
    const normalizedPath = this.normalizePath(path);
    const existing = this.subscriptions.get(normalizedPath);
    if (existing) return existing as Observable<T | null>;

    const source = new Observable<unknown | null>((observer) => {
      const subscription: RealtimeDataSubscription = { path: normalizedPath };
      const onChanged = (event: RealtimeDataChangedEvent): void => {
        if (event.path === normalizedPath) observer.next(event.value);
      };
      const onConnect = (): void => {
        this.socket.emit(REALTIME_DATA_EVENT.SUBSCRIBE, subscription);
      };

      this.socket.on(REALTIME_DATA_EVENT.CHANGED, onChanged);
      this.socket.on('connect', onConnect);
      if (this.socket.connected) onConnect();
      else this.socket.connect();

      return () => {
        this.socket.off(REALTIME_DATA_EVENT.CHANGED, onChanged);
        this.socket.off('connect', onConnect);
        if (this.socket.connected) {
          this.socket.emit(REALTIME_DATA_EVENT.UNSUBSCRIBE, subscription);
        }
      };
    });

    let shared!: Observable<unknown | null>;
    shared = source.pipe(
      finalize(() => {
        if (this.subscriptions.get(normalizedPath) === shared) {
          this.subscriptions.delete(normalizedPath);
        }
      }),
      shareReplay({ bufferSize: 1, refCount: true }),
    );
    this.subscriptions.set(normalizedPath, shared);
    return shared as Observable<T | null>;
  }

  private async mutate(
    operation: 'set' | 'update' | 'remove',
    request: () => Observable<RealtimeMutationResponse>,
  ): Promise<void> {
    try {
      await firstValueFrom(request());
    } catch (error) {
      this.logger.error(`RealtimeDataService.${operation}`, error);
      throw error;
    }
  }

  private normalizePath(path: string): string {
    const normalized = path.trim().replace(/^\/+|\/+$/g, '').replace(/\/{2,}/g, '/');
    if (!normalized) throw new Error('Data path is required.');
    return normalized;
  }
}
