import { createFeature, createReducer, on } from '@ngrx/store';
import { ConnectionActions } from './connection.actions';

export type ConnectionStatus = 'connecting' | 'online' | 'reconnecting' | 'offline';

export interface ConnectionState {
  status: ConnectionStatus;
}

export const connectionFeature = createFeature({
  name: 'connection',
  reducer: createReducer<ConnectionState>(
    { status: 'connecting' },
    on(ConnectionActions.connected, () => ({ status: 'online' as const })),
    on(ConnectionActions.disconnected, (state) =>
      state.status === 'offline' ? state : { status: 'reconnecting' as const },
    ),
    on(ConnectionActions.browserOffline, () => ({ status: 'offline' as const })),
    on(ConnectionActions.browserOnline, (state) =>
      state.status === 'offline' ? { status: 'reconnecting' as const } : state,
    ),
  ),
});
