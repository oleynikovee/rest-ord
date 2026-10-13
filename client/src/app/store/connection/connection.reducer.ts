import { createFeature, createReducer, on } from '@ngrx/store';
import { MenuActions } from '../menu/menu.actions';
import { ConnectionActions } from './connection.actions';

export type ConnectionStatus = 'connecting' | 'online' | 'reconnecting' | 'offline';

export interface ConnectionState {
  status: ConnectionStatus;
  lastSeq: number;
}

const initialState: ConnectionState = { status: 'connecting', lastSeq: 0 };

export const connectionFeature = createFeature({
  name: 'connection',
  reducer: createReducer<ConnectionState>(
    initialState,
    on(ConnectionActions.connected, (state): ConnectionState => ({ ...state, status: 'online' })),
    on(ConnectionActions.disconnected, (state): ConnectionState =>
      state.status === 'offline' ? state : { ...state, status: 'reconnecting' },
    ),
    on(ConnectionActions.browserOffline, (state): ConnectionState => ({ ...state, status: 'offline' })),
    on(ConnectionActions.browserOnline, (state): ConnectionState =>
      state.status === 'offline' ? { ...state, status: 'reconnecting' } : state,
    ),
    on(ConnectionActions.seqAdvanced, (state, { seq }): ConnectionState => ({
      ...state,
      lastSeq: Math.max(state.lastSeq, seq),
    })),
    on(MenuActions.loadSuccess, (state, { snapshot }): ConnectionState => ({
      ...state,
      lastSeq: Math.max(state.lastSeq, snapshot.seq),
    })),
  ),
});
