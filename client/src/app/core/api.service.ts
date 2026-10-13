import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { type MonoTypeOperatorFunction, type Observable, retry, timer } from 'rxjs';
import type {
  Category,
  CreateOrderRequest,
  CurrentSessionResponse,
  EventsPage,
  LoginRequest,
  MenuItem,
  MenuItemInput,
  MenuSnapshot,
  Order,
  OrdersPage,
  PromoCode,
  PromoCodeInput,
  PromoQuote,
  RegisterRequest,
  SessionResponse,
  ValidatePromoRequest,
} from './models';

/** Retries idempotent GETs on network / gateway errors with exponential backoff. */
const retryReads = <T>(): MonoTypeOperatorFunction<T> =>
  retry<T>({
    count: 3,
    delay: (error: { status?: number }, attempt) => {
      if (error.status !== undefined && error.status !== 0 && error.status < 502) throw error;
      return timer(500 * 2 ** (attempt - 1));
    },
  });

export interface Versioned {
  id: string;
  version: number;
}

const ifMatch = (entity: Versioned): { headers: HttpHeaders } => ({
  headers: new HttpHeaders({ 'If-Match': `"${entity.version}"` }),
});

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);

  getSession(): Observable<CurrentSessionResponse> {
    return this.http.get<CurrentSessionResponse>('/api/auth/me').pipe(retryReads());
  }

  login(request: LoginRequest): Observable<SessionResponse> {
    return this.http.post<SessionResponse>('/api/auth/login', request);
  }

  register(request: RegisterRequest): Observable<SessionResponse> {
    return this.http.post<SessionResponse>('/api/auth/register', request);
  }

  logout(): Observable<void> {
    return this.http.post<void>('/api/auth/logout', null);
  }

  validatePromo(request: ValidatePromoRequest): Observable<PromoQuote> {
    return this.http.post<PromoQuote>('/api/promo-codes/validate', request);
  }

  getPromoCodes(): Observable<PromoCode[]> {
    return this.http.get<PromoCode[]>('/api/promo-codes');
  }

  createPromoCode(input: PromoCodeInput): Observable<PromoCode> {
    return this.http.post<PromoCode>('/api/promo-codes', input);
  }

  updatePromoCode(promo: Versioned, input: PromoCodeInput): Observable<PromoCode> {
    return this.http.patch<PromoCode>(`/api/promo-codes/${promo.id}`, input, ifMatch(promo));
  }

  /** Events after `after` that this user may see (see EventsPage). */
  getEvents(after: number): Observable<EventsPage> {
    return this.http.get<EventsPage>('/api/events', { params: { after } }).pipe(retryReads());
  }

  getMenu(): Observable<MenuSnapshot> {
    return this.http.get<MenuSnapshot>('/api/menu').pipe(retryReads());
  }

  /** `before`: the `nextCursor` of the previous page. */
  getOrders(before?: number): Observable<OrdersPage> {
    const params = before === undefined ? undefined : { before };
    return this.http.get<OrdersPage>('/api/orders', { params }).pipe(retryReads());
  }

  placeOrder(request: CreateOrderRequest, idempotencyKey: string): Observable<Order> {
    return this.http.post<Order>('/api/orders', request, {
      headers: new HttpHeaders({ 'Idempotency-Key': idempotencyKey }),
    });
  }

  createCategory(name: string): Observable<Category> {
    return this.http.post<Category>('/api/categories', { name });
  }

  // Writes send the version they are based on: the server refuses them (412) if it is outdated.
  updateCategory(category: Versioned, name: string): Observable<Category> {
    return this.http.patch<Category>(`/api/categories/${category.id}`, { name }, ifMatch(category));
  }

  deleteCategory(category: Versioned): Observable<void> {
    return this.http.delete<void>(`/api/categories/${category.id}`, ifMatch(category));
  }

  createItem(input: MenuItemInput): Observable<MenuItem> {
    return this.http.post<MenuItem>('/api/items', input);
  }

  updateItem(item: Versioned, changes: Partial<MenuItemInput>): Observable<MenuItem> {
    return this.http.patch<MenuItem>(`/api/items/${item.id}`, changes, ifMatch(item));
  }

  deleteItem(item: Versioned): Observable<void> {
    return this.http.delete<void>(`/api/items/${item.id}`, ifMatch(item));
  }

}
