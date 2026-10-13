import { Logger, type OnApplicationShutdown } from '@nestjs/common';
import {
  type OnGatewayConnection,
  type OnGatewayDisconnect,
  type OnGatewayInit,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server } from 'socket.io';
import { type MenuEvent, type OrderEvent, TOPICS } from '../domain/models.js';
import { EventBus } from '../domain/ports.js';

/**
 * Pushes domain events to browsers. Socket.IO is used for its built-in
 * reconnection, heartbeats and long-polling fallback on hostile networks.
 */
@WebSocketGateway({ cors: { origin: true } })
export class RealtimeGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect, OnApplicationShutdown
{
  private readonly logger = new Logger(RealtimeGateway.name);
  private readonly unsubscribe: Array<() => void> = [];

  @WebSocketServer()
  private server!: Server;

  constructor(private readonly bus: EventBus) {}

  afterInit(): void {
    this.unsubscribe.push(
      this.bus.subscribe<MenuEvent>(TOPICS.menu, (event) =>
        this.server.emit('menu', event),
      ),
      this.bus.subscribe<OrderEvent>(TOPICS.orders, (event) =>
        this.server.emit('order', event),
      ),
    );
  }

  handleConnection(): void {
    this.logger.debug(`Client connected (${this.server.engine.clientsCount} online)`);
  }

  handleDisconnect(): void {
    this.logger.debug(`Client disconnected (${this.server.engine.clientsCount} online)`);
  }

  onApplicationShutdown(): void {
    this.unsubscribe.forEach((fn) => fn());
  }
}
