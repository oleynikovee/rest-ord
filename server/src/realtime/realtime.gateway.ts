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

const ADMINS_ROOM = 'role:admin';
const userRoom = (userId: string): string => `user:${userId}`;

/**
 * Pushes domain events to browsers. Socket.IO is used for its built-in
 * reconnection, heartbeats and long-polling fallback on hostile networks.
 *
 * The menu is public and goes to everyone. Order events go only to the order's
 * owner and to admins: the session cookie is verified on the handshake and the
 * socket joins its rooms. Same-origin only (no CORS), like the REST API.
 */
// Heartbeats every 10 s: a dead connection is noticed within ~15 s (default: up to 45 s).
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
  ) {}

  afterInit(): void {
    this.unsubscribe.push(
      // Envelopes carry `seq`, so clients know where to resume after a reconnect.
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
    this.logger.debug(`Client disconnected (${this.server.engine.clientsCount} online)`);
  }

  onApplicationShutdown(): void {
    this.unsubscribe.forEach((fn) => fn());
  }
}
