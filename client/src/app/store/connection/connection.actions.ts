import { createActionGroup, emptyProps, props } from '@ngrx/store';

export const ConnectionActions = createActionGroup({
  source: 'Connection',
  events: {
    Connected: props<{ reconnect: boolean }>(),
    Disconnected: emptyProps(),
    'Browser Online': emptyProps(),
    'Browser Offline': emptyProps(),
  },
});
