import type { User } from '../../core/models';
import { AuthActions } from './auth.actions';
import { authFeature } from './auth.reducer';

const { reducer } = authFeature;
const initial = reducer(undefined, { type: 'init' });
const admin: User = { id: 'u1', email: 'a@test.local', name: 'Admin', role: 'admin' };

describe('auth reducer', () => {
  it('starts unknown and becomes anonymous without a session', () => {
    expect(initial.status).toBe('unknown');
    expect(reducer(initial, AuthActions.sessionLoaded({ user: null })).status).toBe('anonymous');
  });

  it('stores the user on sign-in and forgets it on logout or expiry', () => {
    const signedIn = reducer(initial, AuthActions.signInSuccess({ user: admin, returnUrl: '/' }));
    expect(signedIn).toMatchObject({ status: 'authenticated', user: admin });
    expect(authFeature.selectIsAdmin.projector(signedIn.user)).toBe(true);

    expect(reducer(signedIn, AuthActions.logoutSuccess())).toMatchObject({ status: 'anonymous', user: null });
    expect(reducer(signedIn, AuthActions.sessionExpired())).toMatchObject({ status: 'anonymous', user: null });
  });

  it('keeps the error of a failed sign-in', () => {
    const submitting = reducer(initial, AuthActions.login({ request: { email: 'x@y.z', password: 'p' }, returnUrl: '/' }));
    expect(submitting.submitting).toBe(true);
    const failed = reducer(
      submitting,
      AuthActions.signInFailure({ error: { status: 401, code: 'INVALID_CREDENTIALS', message: 'Invalid email or password.' } }),
    );
    expect(failed).toMatchObject({ submitting: false, error: { code: 'INVALID_CREDENTIALS' } });
  });
});
