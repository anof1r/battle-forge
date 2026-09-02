import { Injectable } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { DataPathResolver } from './data-path';
import { DataStoreService } from './data-store.service';

const DATA_ROOM_PREFIX = 'data:';

interface DataSubscription {
  path: string;
}

export interface DataChangedEvent {
  path: string;
  value: unknown | null;
}

@Injectable()
@WebSocketGateway()
export class DataGateway {
  @WebSocketServer()
  private server!: Server;

  constructor(
    private readonly store: DataStoreService,
    private readonly paths: DataPathResolver,
  ) {}

  @SubscribeMessage('data:subscribe')
  async subscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: unknown,
  ): Promise<DataChangedEvent> {
    const path = this.subscriptionPath(payload);
    await client.join(this.room(path));
    const event = { path, value: await this.store.get(path) };
    client.emit('data:changed', event);
    return event;
  }

  @SubscribeMessage('data:unsubscribe')
  async unsubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: unknown,
  ): Promise<{ path: string }> {
    const path = this.subscriptionPath(payload);
    await client.leave(this.room(path));
    return { path };
  }

  async publishRelated(changedPath: string): Promise<void> {
    const normalizedPath = this.paths.resolve(changedPath).normalizedPath;
    const subscriptions = [...this.server.sockets.adapter.rooms.keys()]
      .filter((room) => room.startsWith(DATA_ROOM_PREFIX))
      .map((room) => room.slice(DATA_ROOM_PREFIX.length))
      .filter((path) => this.paths.isRelated(path, normalizedPath));

    await Promise.all(
      subscriptions.map(async (path) => {
        const event: DataChangedEvent = { path, value: await this.store.get(path) };
        this.server.to(this.room(path)).emit('data:changed', event);
      }),
    );
  }

  private subscriptionPath(payload: unknown): string {
    if (!this.isSubscription(payload)) {
      throw new WsException('A data subscription requires a path.');
    }
    try {
      return this.paths.resolve(payload.path).normalizedPath;
    } catch (error) {
      throw new WsException(error instanceof Error ? error.message : 'Invalid data path.');
    }
  }

  private room(path: string): string {
    return `${DATA_ROOM_PREFIX}${path}`;
  }

  private isSubscription(payload: unknown): payload is DataSubscription {
    return (
      payload !== null &&
      typeof payload === 'object' &&
      typeof (payload as Record<string, unknown>)['path'] === 'string'
    );
  }
}
