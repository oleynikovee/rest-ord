import { Logger, type OnApplicationShutdown } from '@nestjs/common';
import {
  type OnGatewayConnection,
  type OnGatewayDisconnect,
  type OnGatewayInit,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { parseCookie } from 'cookie';
import type { Server, Socket } from 'socket.io';
import { AuthService } from '../auth/auth.service.js';
import { SESSION_COOKIE } from '../auth/auth.types.js';
import { type EventEnvelope, SOCKET_EVENTS, TOPICS } from '../domain/models.js';
import { EventBus } from '../domain/ports.js';
import { MetricsService } from '../observability/metrics.service.js';

const ADMINS_ROOM = 'role:admin';
const userRoom = (userId: string): string => `user:${userId}`;

@WebSocketGateway({ pingInterval: 10_000, pingTimeout: 5_000 })
export class RealtimeGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect, OnApplicationShutdown
{
  private readonly logger = new Logger(RealtimeGateway.name);
  private readonly unsubscribe: Array<() => void> = [];

  @WebSocketServer()
  private server!: Server;

  constructor(
    private readonly bus: EventBus,
    private readonly auth: AuthService,
    private readonly metrics: MetricsService,
  ) {}

  afterInit(): void {
    this.unsubscribe.push(
      this.bus.subscribe<EventEnvelope>(TOPICS.menu, (envelope) =>
        this.server.emit(SOCKET_EVENTS.menu, envelope),
      ),
      this.bus.subscribe<EventEnvelope>(TOPICS.orders, (envelope) => {
        if (envelope.topic !== TOPICS.orders) return;
        const rooms = [ADMINS_ROOM];
        if (envelope.event.order.userId) rooms.push(userRoom(envelope.event.order.userId));
        this.server.to(rooms).emit(SOCKET_EVENTS.order, envelope);
      }),
    );
  }

  async handleConnection(client: Socket): Promise<void> {
    this.metrics.socketConnections.inc();
    const token = parseCookie(client.handshake.headers.cookie ?? '')[SESSION_COOKIE];
    const user = token ? await this.auth.verifyToken(token) : null;
    if (user) {
      await client.join(user.role === 'admin' ? [ADMINS_ROOM, userRoom(user.id)] : [userRoom(user.id)]);
    }
    this.logger.debug(
      `Client connected as ${user ? `${user.role} ${user.id}` : 'anonymous'} (${this.server.engine.clientsCount} online)`,
    );
  }

  handleDisconnect(): void {
    this.metrics.socketConnections.dec();
    this.logger.debug(`Client disconnected (${this.server.engine.clientsCount} online)`);
  }

  onApplicationShutdown(): void {
    this.unsubscribe.forEach((fn) => fn());
  }
}
