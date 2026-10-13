import { createActionGroup, emptyProps, props } from '@ngrx/store';
import type { ApiError } from '../../core/api-error';
import type { LoginRequest, RegisterRequest, User } from '../../core/models';

export const AuthActions = createActionGroup({
  source: 'Auth',
  events: {
    'Session Loaded': props<{ user: User | null }>(),
    'Session Load Failure': props<{ error: ApiError }>(),
    Login: props<{ request: LoginRequest; returnUrl: string }>(),
    Register: props<{ request: RegisterRequest; returnUrl: string }>(),
    'Sign In Success': props<{ user: User; returnUrl: string }>(),
    'Sign In Failure': props<{ error: ApiError }>(),
    Logout: emptyProps(),
    'Logout Success': emptyProps(),
    /** The server answered 401 to a request that needed a session. */
    'Session Expired': emptyProps(),
  },
});
