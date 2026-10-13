import { createActionGroup, emptyProps, props } from '@ngrx/store';
import type { ApiError } from '../../core/api-error';

export const ConnectionActions = createActionGroup({
  source: 'Connection',
  events: {
    Connected: props<{ reconnect: boolean }>(),
    Disconnected: emptyProps(),
    'Browser Online': emptyProps(),
    'Browser Offline': emptyProps(),
    'Seq Advanced': props<{ seq: number }>(),
    'Replay Failure': props<{ error: ApiError }>(),
  },
});
