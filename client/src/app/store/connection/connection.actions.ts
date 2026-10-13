import { createActionGroup, emptyProps, props } from '@ngrx/store';
import type { ApiError } from '../../core/api-error';

export const ConnectionActions = createActionGroup({
  source: 'Connection',
  events: {
    Connected: props<{ reconnect: boolean }>(),
    Disconnected: emptyProps(),
    'Browser Online': emptyProps(),
    'Browser Offline': emptyProps(),
    /** The client has applied every event up to `seq` of the server's event log. */
    'Seq Advanced': props<{ seq: number }>(),
    'Replay Failure': props<{ error: ApiError }>(),
  },
});
