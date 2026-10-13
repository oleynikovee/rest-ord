import { Injectable, type OnDestroy } from '@angular/core';
import type { Socket } from 'socket.io-client';
import { Observable, from, share, switchMap } from 'rxjs';
import { type EventEnvelope, SOCKET_EVENTS } from '../../core/models';

export type RealtimeEvent =
  | { kind: 'connected'; reconnect: boolean }
  | { kind: 'disconnected' }
  | { kind: 'event'; envelope: EventEnvelope };

/**
 * Thin wrapper around Socket.IO. Reconnection with exponential backoff and
 * the long-polling fallback come from the library. The client library is
 * loaded lazily so it does not delay the first render.
 */
@Injectable({ providedIn: 'root' })
export class RealtimeService implements OnDestroy {
  private socket?: Socket;

  readonly events$ = from(import('socket.io-client')).pipe(
    switchMap(
      ({ io }) =>
        new Observable<RealtimeEvent>((subscriber) => {
          const socket = io({
            path: '/socket.io',
            reconnectionDelay: 1000,
            reconnectionDelayMax: 10000,
            randomizationFactor: 0.5,
          });
          this.socket = socket;
          let connectedBefore = false;

          socket.on('connect', () => {
            subscriber.next({ kind: 'connected', reconnect: connectedBefore });
            connectedBefore = true;
          });
          socket.on('disconnect', () => subscriber.next({ kind: 'disconnected' }));
          socket.on('connect_error', () => subscriber.next({ kind: 'disconnected' }));
          const forward = (envelope: EventEnvelope): void => subscriber.next({ kind: 'event', envelope });
          socket.on(SOCKET_EVENTS.menu, forward);
          socket.on(SOCKET_EVENTS.order, forward);

          return () => {
            socket.removeAllListeners();
            socket.disconnect();
          };
        }),
    ),
    share(),
  );

  /** Re-handshakes so the server re-reads the session cookie and updates the socket's rooms. */
  reconnect(): void {
    if (!this.socket) return;
    this.socket.disconnect();
    this.socket.connect();
  }

  ngOnDestroy(): void {
    this.socket?.disconnect();
  }
}
