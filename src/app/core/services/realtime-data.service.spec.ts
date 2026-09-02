import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Socket } from 'socket.io-client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { REALTIME_DATA_EVENT } from '../constants/realtime-data.constants';
import { RealtimeDataChangedEvent } from '../models/realtime-data.model';
import {
  REALTIME_SOCKET,
  RealtimeDataService,
} from './realtime-data.service';
import { LoggerService } from './logger.service';

class SocketFake {
  connected = true;
  readonly emit = vi.fn();
  readonly connect = vi.fn(() => {
    this.connected = true;
    this.fire('connect');
  });
  private readonly listeners = new Map<string, Set<(...args: never[]) => void>>();

  on(event: string, listener: (...args: never[]) => void): this {
    const eventListeners = this.listeners.get(event) ?? new Set();
    eventListeners.add(listener);
    this.listeners.set(event, eventListeners);
    return this;
  }

  off(event: string, listener: (...args: never[]) => void): this {
    this.listeners.get(event)?.delete(listener);
    return this;
  }

  fire(event: string, value?: unknown): void {
    for (const listener of this.listeners.get(event) ?? []) {
      listener(value as never);
    }
  }
}

describe('RealtimeDataService', () => {
  let service: RealtimeDataService;
  let http: HttpTestingController;
  let socket: SocketFake;
  let logger: { error: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    socket = new SocketFake();
    logger = { error: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        RealtimeDataService,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: REALTIME_SOCKET, useValue: socket as unknown as Socket },
        { provide: LoggerService, useValue: logger },
      ],
    });
    service = TestBed.inject(RealtimeDataService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  it('uses the compatibility REST contract for reads and mutations', async () => {
    const getPromise = service.get<{ currentHp: number }>('/players/Aria/');
    http.expectOne('/api/data?path=players/Aria').flush({ currentHp: 12 });
    await expect(getPromise).resolves.toEqual({ currentHp: 12 });

    const setPromise = service.set('players/Aria/currentHp', 9);
    const setRequest = http.expectOne('/api/data');
    expect(setRequest.request.method).toBe('PUT');
    expect(setRequest.request.body).toEqual({ path: 'players/Aria/currentHp', data: 9 });
    setRequest.flush({ success: true });
    await setPromise;

    const updatePromise = service.update('rooms/main-room', { round: 2 });
    const updateRequest = http.expectOne('/api/data');
    expect(updateRequest.request.method).toBe('PATCH');
    expect(updateRequest.request.body).toEqual({
      path: 'rooms/main-room',
      data: { round: 2 },
    });
    updateRequest.flush({ success: true });
    await updatePromise;

    const removePromise = service.remove('players/Aria');
    const removeRequest = http.expectOne('/api/data?path=players/Aria');
    expect(removeRequest.request.method).toBe('DELETE');
    removeRequest.flush({ success: true });
    await removePromise;
  });

  it('shares one socket room between subscribers and releases it at the end', () => {
    const firstValues: Array<{ round: number } | null> = [];
    const secondValues: Array<{ round: number } | null> = [];
    const stream = service.subscribe<{ round: number }>('rooms/main-room');
    const first = stream.subscribe((value) => firstValues.push(value));
    const second = stream.subscribe((value) => secondValues.push(value));

    expect(socket.emit).toHaveBeenCalledTimes(1);
    expect(socket.emit).toHaveBeenCalledWith(REALTIME_DATA_EVENT.SUBSCRIBE, {
      path: 'rooms/main-room',
    });

    const change: RealtimeDataChangedEvent<{ round: number }> = {
      path: 'rooms/main-room',
      value: { round: 3 },
    };
    socket.fire(REALTIME_DATA_EVENT.CHANGED, change);
    expect(firstValues).toEqual([{ round: 3 }]);
    expect(secondValues).toEqual([{ round: 3 }]);

    first.unsubscribe();
    expect(socket.emit).toHaveBeenCalledTimes(1);
    second.unsubscribe();
    expect(socket.emit).toHaveBeenLastCalledWith(REALTIME_DATA_EVENT.UNSUBSCRIBE, {
      path: 'rooms/main-room',
    });
  });

  it('logs an HTTP failure with the operation context', async () => {
    const promise = service.set('players/Aria/currentHp', 9);
    http.expectOne('/api/data').flush('failure', { status: 500, statusText: 'Server Error' });

    await expect(promise).rejects.toBeDefined();
    expect(logger.error).toHaveBeenCalledWith('RealtimeDataService.set', expect.anything());
  });
});
