import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { MockStore, provideMockStore } from '@ngrx/store/testing';
import { AuthActions } from '../store/auth/auth.actions';
import { authInterceptor } from './auth.interceptor';

describe('authInterceptor', () => {
  let http: HttpClient;
  let backend: HttpTestingController;
  let dispatch: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        provideMockStore(),
      ],
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
    dispatch = vi.spyOn(TestBed.inject(MockStore), 'dispatch');
  });

  it('reports an expired session on protected calls', () => {
    http.get('/api/orders').subscribe({ error: () => undefined });
    backend.expectOne('/api/orders').flush({}, { status: 401, statusText: 'Unauthorized' });
    expect(dispatch).toHaveBeenCalledWith(AuthActions.sessionExpired());
  });

  it('leaves failed sign-in attempts to the login page', () => {
    http.post('/api/auth/login', {}).subscribe({ error: () => undefined });
    backend.expectOne('/api/auth/login').flush({}, { status: 401, statusText: 'Unauthorized' });
    expect(dispatch).not.toHaveBeenCalled();
  });
});
