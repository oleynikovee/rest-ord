import { TestBed } from '@angular/core/testing';
import { type ActivatedRouteSnapshot, Router, type RouterStateSnapshot, UrlTree, provideRouter } from '@angular/router';
import { provideMockStore } from '@ngrx/store/testing';
import { type Observable, firstValueFrom } from 'rxjs';
import type { AuthState } from '../store/auth/auth.reducer';
import { adminGuard, authGuard } from './auth.guards';

function run(
  guard: typeof authGuard,
  auth: Partial<AuthState>,
  url: string,
): Promise<boolean | UrlTree> {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      provideMockStore({
        initialState: { auth: { user: null, status: 'anonymous', submitting: false, error: null, ...auth } },
      }),
    ],
  });
  const result = TestBed.runInInjectionContext(() =>
    guard({} as ActivatedRouteSnapshot, { url } as RouterStateSnapshot),
  ) as Observable<boolean | UrlTree>;
  return firstValueFrom(result);
}

const serialize = (result: boolean | UrlTree): string | boolean =>
  result instanceof UrlTree ? TestBed.inject(Router).serializeUrl(result) : result;

describe('auth guards', () => {
  it('sends anonymous users to the login page with a return URL', async () => {
    expect(serialize(await run(authGuard, {}, '/orders'))).toBe('/login?returnUrl=%2Forders');
  });

  it('lets signed-in users through', async () => {
    const user = { id: 'u', email: 'c@test.local', name: 'C', role: 'customer' as const };
    expect(await run(authGuard, { status: 'authenticated', user }, '/orders')).toBe(true);
  });

  it('keeps customers out of the admin area', async () => {
    const user = { id: 'u', email: 'c@test.local', name: 'C', role: 'customer' as const };
    expect(serialize(await run(adminGuard, { status: 'authenticated', user }, '/setup'))).toBe('/menu');
  });

  it('lets admins into the admin area', async () => {
    const user = { id: 'u', email: 'a@test.local', name: 'A', role: 'admin' as const };
    expect(await run(adminGuard, { status: 'authenticated', user }, '/setup')).toBe(true);
  });
});
