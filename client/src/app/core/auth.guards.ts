import { inject } from '@angular/core';
import { type CanActivateFn, Router, type UrlTree } from '@angular/router';
import { Store } from '@ngrx/store';
import { type Observable, filter, map, take } from 'rxjs';
import { type AuthState, authFeature } from '../store/auth/auth.reducer';

/** Waits until the server confirmed whether there is a session. */
function resolvedAuth(): Observable<AuthState> {
  return inject(Store)
    .select(authFeature.selectAuthState)
    .pipe(
      filter((auth) => auth.status !== 'unknown'),
      take(1),
    );
}

/** UX only: the server enforces the same rules on every request. */
export const authGuard: CanActivateFn = (_, state): Observable<boolean | UrlTree> => {
  const router = inject(Router);
  return resolvedAuth().pipe(
    map((auth) =>
      auth.status === 'authenticated'
        ? true
        : router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } }),
    ),
  );
};

export const adminGuard: CanActivateFn = (_, state): Observable<boolean | UrlTree> => {
  const router = inject(Router);
  return resolvedAuth().pipe(
    map((auth) => {
      if (auth.status !== 'authenticated') {
        return router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
      }
      return auth.user?.role === 'admin' ? true : router.createUrlTree(['/menu']);
    }),
  );
};
