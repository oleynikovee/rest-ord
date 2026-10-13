import { createFeature, createReducer, createSelector, on } from '@ngrx/store';
import type { ApiError } from '../../core/api-error';
import type { User } from '../../core/models';
import { AuthActions } from './auth.actions';

export type AuthStatus = 'unknown' | 'anonymous' | 'authenticated';

export interface AuthState {
  user: User | null;
  status: AuthStatus;
  submitting: boolean;
  error: ApiError | null;
}

const initialState: AuthState = {
  user: null,
  status: 'unknown',
  submitting: false,
  error: null,
};

const signedOut = (state: AuthState): AuthState => ({
  ...state,
  user: null,
  status: 'anonymous',
  submitting: false,
});

export const authFeature = createFeature({
  name: 'auth',
  reducer: createReducer(
    initialState,
    on(AuthActions.sessionLoaded, (state, { user }): AuthState => ({
      ...state,
      user,
      status: user ? 'authenticated' : 'anonymous',
    })),
    on(AuthActions.sessionLoadFailure, (state): AuthState => signedOut(state)),
    on(AuthActions.login, AuthActions.register, (state): AuthState => ({
      ...state,
      submitting: true,
      error: null,
    })),
    on(AuthActions.signInSuccess, (state, { user }): AuthState => ({
      ...state,
      user,
      status: 'authenticated',
      submitting: false,
      error: null,
    })),
    on(AuthActions.signInFailure, (state, { error }): AuthState => ({
      ...state,
      submitting: false,
      error,
    })),
    on(AuthActions.logoutSuccess, AuthActions.sessionExpired, (state): AuthState => signedOut(state)),
  ),
  extraSelectors: ({ selectUser }) => ({
    selectIsAdmin: createSelector(selectUser, (user) => user?.role === 'admin'),
  }),
});
