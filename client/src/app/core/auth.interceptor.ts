import { HttpErrorResponse, type HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Store } from '@ngrx/store';
import { catchError, throwError } from 'rxjs';
import { AuthActions } from '../store/auth/auth.actions';

/**
 * The session lives in an httpOnly cookie that the browser sends by itself, so the
 * interceptor only reacts to a lost session (expired or revoked) on protected calls.
 */
export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const store = inject(Store);
  return next(request).pipe(
    catchError((error: unknown) => {
      if (
        error instanceof HttpErrorResponse &&
        error.status === 401 &&
        !request.url.startsWith('/api/auth/')
      ) {
        store.dispatch(AuthActions.sessionExpired());
      }
      return throwError(() => error);
    }),
  );
};
